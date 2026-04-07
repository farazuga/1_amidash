# Simplify Digital Signage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 16-slide digital signage system with a clean two-block layout featuring 5 block types, admin-editable custom content, and cleaned-up code.

**Architecture:** Canvas-based rendering engine stays. SlideManager replaced by LayoutManager that renders two independent block slots. Old slides replaced by 5 block types extending a new BaseBlock class. Admin UI cleaned up with block content management.

**Tech Stack:** Node.js canvas (@napi-rs/canvas), Supabase (DB + Storage), Next.js admin UI, Zod validation, Express API

---

### Task 1: Database Migration — New Schema

**Files:**
- Create: `supabase/migrations/048_signage_blocks.sql`

**Step 1: Write migration**

```sql
-- Drop old signage_slides table and create new signage_blocks + signage_settings tables

-- Drop old table
DROP TABLE IF EXISTS signage_slides;

-- Create signage_blocks table
CREATE TABLE signage_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type TEXT NOT NULL CHECK (block_type IN ('po-highlight', 'projects-invoiced', 'quick-stats', 'rich-text', 'picture')),
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  position TEXT NOT NULL DEFAULT 'both' CHECK (position IN ('left', 'right', 'both')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create signage_settings table (single row)
CREATE TABLE signage_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_interval_ms INTEGER NOT NULL DEFAULT 15000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update triggers
CREATE TRIGGER set_signage_blocks_updated_at
  BEFORE UPDATE ON signage_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_signage_settings_updated_at
  BEFORE UPDATE ON signage_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_signage_blocks_position_order ON signage_blocks (position, display_order);
CREATE INDEX idx_signage_blocks_enabled ON signage_blocks (enabled);

-- RLS
ALTER TABLE signage_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE signage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read signage blocks"
  ON signage_blocks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage signage blocks"
  ON signage_blocks FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Authenticated users can read signage settings"
  ON signage_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage signage settings"
  ON signage_settings FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Insert default settings row
INSERT INTO signage_settings (rotation_interval_ms) VALUES (15000);

-- Insert default data-driven blocks
INSERT INTO signage_blocks (block_type, title, position, display_order) VALUES
  ('quick-stats', 'Quick Stats', 'both', 0),
  ('po-highlight', 'PO Highlight', 'both', 1),
  ('projects-invoiced', 'Projects Invoiced', 'both', 2);

-- Create storage bucket for signage images
INSERT INTO storage.buckets (id, name, public)
VALUES ('signage-images', 'signage-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload signage images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signage-images');

CREATE POLICY "Anyone can view signage images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'signage-images');

CREATE POLICY "Authenticated users can delete signage images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signage-images');
```

**Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

**Step 3: Commit**

```bash
git add supabase/migrations/048_signage_blocks.sql
git commit -m "feat(signage): add signage_blocks and signage_settings tables, drop old signage_slides"
```

---

### Task 2: Delete Old Slide Files from Engine

**Files:**
- Delete: All files in `signage-engine/src/renderer/slides/` (16 slide files + base-slide.ts)
- Delete: `signage-engine/src/renderer/components/charts.ts`
- Delete: `signage-engine/src/renderer/components/gauge.ts`
- Delete: `signage-engine/src/renderer/components/animations.ts`
- Delete: `signage-engine/src/data/fetchers/metrics.ts`
- Delete: `signage-engine/src/data/fetchers/dashboard-metrics.ts`
- Delete: `signage-engine/src/data/fetchers/schedule.ts`
- Delete: `signage-engine/src/data/fetchers/slide-config.ts`

**Step 1: Delete old files**

```bash
rm -rf signage-engine/src/renderer/slides/
rm signage-engine/src/renderer/components/charts.ts
rm signage-engine/src/renderer/components/gauge.ts
rm signage-engine/src/renderer/components/animations.ts
rm signage-engine/src/data/fetchers/metrics.ts
rm signage-engine/src/data/fetchers/dashboard-metrics.ts
rm signage-engine/src/data/fetchers/schedule.ts
rm signage-engine/src/data/fetchers/slide-config.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore(signage): delete old slide types, unused components, and fetchers"
```

---

### Task 3: New Block Types & Fetcher — blocks-config.ts

**Files:**
- Create: `signage-engine/src/data/fetchers/blocks-config.ts`

**Step 1: Write the blocks config fetcher**

This replaces the old `slide-config.ts`. Fetches enabled blocks and global settings from the new tables.

```typescript
import { getSupabaseClient } from '../supabase-client';
import { logger } from '../../utils/logger';

export type BlockType = 'po-highlight' | 'projects-invoiced' | 'quick-stats' | 'rich-text' | 'picture';
export type BlockPosition = 'left' | 'right' | 'both';

export interface SignageBlock {
  id: string;
  block_type: BlockType;
  title: string;
  content: Record<string, unknown>;
  enabled: boolean;
  position: BlockPosition;
  display_order: number;
}

export interface SignageSettings {
  rotation_interval_ms: number;
}

export interface BlocksConfig {
  blocks: SignageBlock[];
  settings: SignageSettings;
}

const DEFAULT_SETTINGS: SignageSettings = {
  rotation_interval_ms: 15000,
};

const DEFAULT_BLOCKS: SignageBlock[] = [
  { id: 'default-1', block_type: 'quick-stats', title: 'Quick Stats', content: {}, enabled: true, position: 'both', display_order: 0 },
  { id: 'default-2', block_type: 'po-highlight', title: 'PO Highlight', content: {}, enabled: true, position: 'both', display_order: 1 },
  { id: 'default-3', block_type: 'projects-invoiced', title: 'Projects Invoiced', content: {}, enabled: true, position: 'both', display_order: 2 },
];

export async function fetchBlocksConfig(): Promise<BlocksConfig> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { blocks: DEFAULT_BLOCKS, settings: DEFAULT_SETTINGS };
  }

  try {
    const [blocksResult, settingsResult] = await Promise.all([
      supabase
        .from('signage_blocks')
        .select('*')
        .eq('enabled', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('signage_settings')
        .select('*')
        .limit(1)
        .single(),
    ]);

    const blocks = (blocksResult.data as SignageBlock[]) || DEFAULT_BLOCKS;
    const settings = (settingsResult.data as SignageSettings) || DEFAULT_SETTINGS;

    return { blocks, settings };
  } catch (error) {
    logger.error({ error }, 'Failed to fetch blocks config');
    return { blocks: DEFAULT_BLOCKS, settings: DEFAULT_SETTINGS };
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/data/fetchers/blocks-config.ts
git commit -m "feat(signage): add blocks-config fetcher for new signage_blocks table"
```

---

### Task 4: Update Fetchers — POs, Projects, Revenue

**Files:**
- Modify: `signage-engine/src/data/fetchers/pos.ts`
- Modify: `signage-engine/src/data/fetchers/projects.ts`
- Modify: `signage-engine/src/data/fetchers/revenue.ts`

**Step 1: Update PO fetcher for "2 largest + 2 newest this month"**

Replace the existing `fetchPOs()` function. The new version fetches POs from the current month, returns the 2 largest by amount and 2 most recent by date (deduped if overlap).

```typescript
// pos.ts — updated interface and fetch function
export interface HighlightPO {
  id: string;
  po_number: string;
  project_name: string;
  client_name: string;
  amount: number;
  created_at: string;
  highlight_reason: 'largest' | 'newest';
}

export async function fetchPOs(): Promise<HighlightPO[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return MOCK_POS;

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, po_number, project_name, client_name, amount, created_at')
      .gte('created_at', startOfMonth.toISOString())
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return MOCK_POS;

    // 2 newest (already sorted by created_at DESC)
    const newest = data.slice(0, 2).map(po => ({ ...po, highlight_reason: 'newest' as const }));

    // 2 largest by amount (exclude any already in newest)
    const newestIds = new Set(newest.map(p => p.id));
    const largest = data
      .filter(po => !newestIds.has(po.id))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 2)
      .map(po => ({ ...po, highlight_reason: 'largest' as const }));

    // If fewer than 2 non-overlapping, fill from remaining
    const result = [...largest, ...newest];
    return result.slice(0, 4);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch POs');
    return MOCK_POS;
  }
}
```

Update `MOCK_POS` to match the new `HighlightPO` interface (add `highlight_reason` field).

**Step 2: Update projects fetcher for "latest 4 invoiced"**

Add a new export `fetchInvoicedProjects()` to projects.ts. Keep the existing `fetchProjects()` for active count in Quick Stats.

```typescript
export interface InvoicedProject {
  id: string;
  name: string;
  client_name: string;
  total_value: number;
  completed_at: string;
}

export async function fetchInvoicedProjects(): Promise<InvoicedProject[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return MOCK_INVOICED;

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, client_name, total_value, updated_at')
      .or('status.eq.invoiced,status.eq.complete')
      .order('updated_at', { ascending: false })
      .limit(4);

    if (error || !data) return MOCK_INVOICED;

    return data.map(p => ({
      id: p.id,
      name: p.name,
      client_name: p.client_name,
      total_value: p.total_value || 0,
      completed_at: p.updated_at,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch invoiced projects');
    return MOCK_INVOICED;
  }
}
```

Add `MOCK_INVOICED` array with 4 sample projects.

**Step 3: Revenue fetcher stays mostly the same**

Ensure `fetchRevenue()` returns `currentMonthRevenue`, `yearToDateRevenue`, and quarterly data. May need to add `quarterGoal` and `quarterRevenue` fields if not present. Check existing interface and add:

```typescript
// Add to RevenueData interface if not present:
export interface RevenueData {
  currentMonthRevenue: number;
  currentMonthGoal: number;
  yearToDateRevenue: number;
  yearToDateGoal: number;
  quarterRevenue: number;
  quarterGoal: number;
  monthlyData: { month: string; revenue: number; goal: number }[];
}
```

**Step 4: Commit**

```bash
git add signage-engine/src/data/fetchers/pos.ts signage-engine/src/data/fetchers/projects.ts signage-engine/src/data/fetchers/revenue.ts
git commit -m "feat(signage): update fetchers for new block types (PO highlight, invoiced projects, revenue)"
```

---

### Task 5: Update Polling Manager

**Files:**
- Modify: `signage-engine/src/data/polling-manager.ts`

**Step 1: Update DataCache interface and polling**

Remove references to old data sources (metrics, dashboardMetrics, schedule, slideConfig). Add blocksConfig and invoicedProjects. Update imports.

New DataCache:

```typescript
import { fetchBlocksConfig, BlocksConfig } from './fetchers/blocks-config';
import { fetchProjects, ActiveProject } from './fetchers/projects';
import { fetchInvoicedProjects, InvoicedProject } from './fetchers/projects';
import { fetchPOs, HighlightPO } from './fetchers/pos';
import { fetchRevenue, RevenueData } from './fetchers/revenue';

export interface DataCache {
  projects: { data: ActiveProject[]; lastUpdated: Date | null };
  invoicedProjects: { data: InvoicedProject[]; lastUpdated: Date | null };
  pos: { data: HighlightPO[]; lastUpdated: Date | null };
  revenue: { data: RevenueData | null; lastUpdated: Date | null };
  blocksConfig: { data: BlocksConfig | null; lastUpdated: Date | null };
  connectionStatus: { isConnected: boolean; usingMockData: boolean; lastError: string | null };
}
```

Polling intervals:
- Projects: 30s
- Invoiced Projects: 60s
- POs: 30s
- Revenue: 60s
- Blocks Config: 30s

**Step 2: Commit**

```bash
git add signage-engine/src/data/polling-manager.ts
git commit -m "feat(signage): update polling manager for new data sources"
```

---

### Task 6: Create BaseBlock Class

**Files:**
- Create: `signage-engine/src/renderer/blocks/base-block.ts`

**Step 1: Write BaseBlock**

New abstract base class. Instead of rendering full-screen, each block renders into a bounded rectangle (the block slot). The LayoutManager will call `render(ctx, x, y, width, height, data)`.

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { COLORS } from '../components/colors';
import { drawText } from '../components/text';

export interface BlockBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockRenderContext {
  ctx: SKRSContext2D;
  bounds: BlockBounds;
  data: Record<string, unknown>;
  deltaTime: number;
}

export abstract class BaseBlock {
  readonly type: string;
  readonly title: string;

  // Typography for blocks (slightly smaller than old full-screen sizes)
  static readonly FONT = {
    TITLE: 56,
    LARGE_VALUE: 72,
    VALUE: 56,
    BODY: 44,
    LABEL: 36,
    SMALL: 32,
  };

  static readonly PADDING = 60;
  static readonly TITLE_HEIGHT = 80;

  constructor(type: string, title: string) {
    this.type = type;
    this.title = title;
  }

  /** Returns the content area inside the block after title */
  protected getContentBounds(bounds: BlockBounds): BlockBounds {
    const pad = BaseBlock.PADDING;
    return {
      x: bounds.x + pad,
      y: bounds.y + pad + BaseBlock.TITLE_HEIGHT,
      width: bounds.width - pad * 2,
      height: bounds.height - pad * 2 - BaseBlock.TITLE_HEIGHT,
    };
  }

  /** Draw block title at the top of the bounds */
  protected drawTitle(ctx: SKRSContext2D, bounds: BlockBounds): void {
    drawText(ctx, this.title, bounds.x + BaseBlock.PADDING, bounds.y + BaseBlock.PADDING + 48, {
      font: 'Inter',
      size: BaseBlock.FONT.TITLE,
      weight: '700',
      color: COLORS.primary,
      align: 'left',
    });
  }

  /** Abstract: each block type implements its own content rendering */
  abstract renderContent(ctx: SKRSContext2D, contentBounds: BlockBounds, data: Record<string, unknown>, deltaTime: number): void;

  /** Called by LayoutManager each frame */
  render(ctx: SKRSContext2D, bounds: BlockBounds, data: Record<string, unknown>, deltaTime: number): void {
    this.drawTitle(ctx, bounds);
    const contentBounds = this.getContentBounds(bounds);
    this.renderContent(ctx, contentBounds, data, deltaTime);
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/renderer/blocks/base-block.ts
git commit -m "feat(signage): add BaseBlock abstract class for new block system"
```

---

### Task 7: Create LayoutManager

**Files:**
- Create: `signage-engine/src/renderer/layout-manager.ts`

**Step 1: Write LayoutManager**

This replaces `slide-manager.ts`. Manages the two-block layout, footer, clock, logo, and independent rotation timers for each slot.

Key responsibilities:
- Draw white background
- Draw two rounded rectangles with dark green stroke
- Draw footer bar with clock (left) and logo (right)
- Maintain two independent block rotation timers
- Fade transition between blocks within each slot
- Accept updated block config from polling manager

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { loadImage } from '@napi-rs/canvas';
import { COLORS } from './components/colors';
import { drawText } from './components/text';
import { BaseBlock, BlockBounds } from './blocks/base-block';
import { SignageBlock, SignageSettings } from '../data/fetchers/blocks-config';
import { createBlock } from './blocks/block-factory';
import { format } from 'date-fns';

interface SlotState {
  blocks: BaseBlock[];
  currentIndex: number;
  elapsed: number;
  transitioning: boolean;
  transitionProgress: number;
  previousIndex: number;
}

export class LayoutManager {
  private width: number;
  private height: number;
  private leftSlot: SlotState;
  private rightSlot: SlotState;
  private rotationInterval: number = 15000;
  private logoImage: any = null;

  // Layout constants
  static readonly FOOTER_HEIGHT = 100;
  static readonly BLOCK_GAP = 30;
  static readonly SCREEN_PADDING = 30;
  static readonly BORDER_RADIUS = 40;
  static readonly BORDER_WIDTH = 8;
  static readonly TRANSITION_DURATION = 500;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.leftSlot = { blocks: [], currentIndex: 0, elapsed: 0, transitioning: false, transitionProgress: 0, previousIndex: 0 };
    this.rightSlot = { blocks: [], currentIndex: 0, elapsed: 0, transitioning: false, transitionProgress: 0, previousIndex: 0 };
    this.loadLogo();
  }

  private async loadLogo(): Promise<void> {
    try {
      // Load amitrace logo from assets
      this.logoImage = await loadImage('assets/logo.png');
    } catch {
      // Logo not found, will skip rendering it
    }
  }

  /** Update block assignments from database config */
  updateConfig(blockConfigs: SignageBlock[], settings: SignageSettings): void {
    this.rotationInterval = settings.rotation_interval_ms;

    const leftBlocks = blockConfigs
      .filter(b => b.position === 'left' || b.position === 'both')
      .map(b => createBlock(b));
    const rightBlocks = blockConfigs
      .filter(b => b.position === 'right' || b.position === 'both')
      .map(b => createBlock(b));

    // Only reset if block list changed
    if (this.blocksChanged(this.leftSlot.blocks, leftBlocks)) {
      this.leftSlot = { blocks: leftBlocks, currentIndex: 0, elapsed: 0, transitioning: false, transitionProgress: 0, previousIndex: 0 };
    }
    if (this.blocksChanged(this.rightSlot.blocks, rightBlocks)) {
      this.rightSlot = { blocks: rightBlocks, currentIndex: 0, elapsed: 0, transitioning: false, transitionProgress: 0, previousIndex: 0 };
    }
  }

  private blocksChanged(current: BaseBlock[], next: BaseBlock[]): boolean {
    if (current.length !== next.length) return true;
    return current.some((b, i) => b.type !== next[i].type || b.title !== next[i].title);
  }

  /** Main render called each frame */
  render(ctx: SKRSContext2D, data: Record<string, unknown>, deltaTime: number): void {
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, this.width, this.height);

    // Calculate block bounds
    const contentHeight = this.height - LayoutManager.FOOTER_HEIGHT;
    const pad = LayoutManager.SCREEN_PADDING;
    const gap = LayoutManager.BLOCK_GAP;
    const blockWidth = (this.width - pad * 2 - gap) / 2;
    const blockHeight = contentHeight - pad * 2;

    const leftBounds: BlockBounds = { x: pad, y: pad, width: blockWidth, height: blockHeight };
    const rightBounds: BlockBounds = { x: pad + blockWidth + gap, y: pad, width: blockWidth, height: blockHeight };

    // Draw block containers (rounded rects with dark green stroke)
    this.drawBlockContainer(ctx, leftBounds);
    this.drawBlockContainer(ctx, rightBounds);

    // Update rotation timers and render blocks
    this.updateSlot(this.leftSlot, deltaTime);
    this.updateSlot(this.rightSlot, deltaTime);
    this.renderSlot(ctx, this.leftSlot, leftBounds, data, deltaTime);
    this.renderSlot(ctx, this.rightSlot, rightBounds, data, deltaTime);

    // Draw footer
    this.drawFooter(ctx);
  }

  private drawBlockContainer(ctx: SKRSContext2D, bounds: BlockBounds): void {
    const r = LayoutManager.BORDER_RADIUS;
    const bw = LayoutManager.BORDER_WIDTH;

    // White fill
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, r);
    ctx.fill();

    // Dark green stroke
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, r);
    ctx.stroke();
  }

  private updateSlot(slot: SlotState, deltaTime: number): void {
    if (slot.blocks.length <= 1) return;

    if (slot.transitioning) {
      slot.transitionProgress += deltaTime / LayoutManager.TRANSITION_DURATION;
      if (slot.transitionProgress >= 1) {
        slot.transitioning = false;
        slot.transitionProgress = 0;
        slot.elapsed = 0;
      }
    } else {
      slot.elapsed += deltaTime;
      if (slot.elapsed >= this.rotationInterval) {
        slot.previousIndex = slot.currentIndex;
        slot.currentIndex = (slot.currentIndex + 1) % slot.blocks.length;
        slot.transitioning = true;
        slot.transitionProgress = 0;
      }
    }
  }

  private renderSlot(ctx: SKRSContext2D, slot: SlotState, bounds: BlockBounds, data: Record<string, unknown>, deltaTime: number): void {
    if (slot.blocks.length === 0) return;

    ctx.save();
    // Clip to block bounds
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, LayoutManager.BORDER_RADIUS);
    ctx.clip();

    if (slot.transitioning && slot.blocks.length > 1) {
      const alpha = slot.transitionProgress;
      // Fade out previous
      ctx.globalAlpha = 1 - alpha;
      slot.blocks[slot.previousIndex]?.render(ctx, bounds, data, deltaTime);
      // Fade in current
      ctx.globalAlpha = alpha;
      slot.blocks[slot.currentIndex]?.render(ctx, bounds, data, deltaTime);
      ctx.globalAlpha = 1;
    } else {
      slot.blocks[slot.currentIndex]?.render(ctx, bounds, data, deltaTime);
    }

    ctx.restore();
  }

  private drawFooter(ctx: SKRSContext2D): void {
    const y = this.height - LayoutManager.FOOTER_HEIGHT;

    // Dark green background
    ctx.fillStyle = COLORS.primary;
    ctx.fillRect(0, y, this.width, LayoutManager.FOOTER_HEIGHT);

    // Clock + date (left side)
    const now = new Date();
    const timeStr = format(now, 'HH:mm');
    const dateStr = format(now, 'EEEE, M/d');
    const clockText = `${timeStr} | ${dateStr}`;

    drawText(ctx, clockText, 60, y + 65, {
      font: 'Inter',
      size: 48,
      weight: '700',
      color: '#FFFFFF',
      align: 'left',
    });

    // Logo (right side)
    if (this.logoImage) {
      const logoHeight = 60;
      const logoWidth = (this.logoImage.width / this.logoImage.height) * logoHeight;
      ctx.drawImage(this.logoImage, this.width - logoWidth - 60, y + (LayoutManager.FOOTER_HEIGHT - logoHeight) / 2, logoWidth, logoHeight);
    }
  }
}
```

**Step 2: Delete old slide-manager.ts**

```bash
rm signage-engine/src/renderer/slide-manager.ts
```

**Step 3: Commit**

```bash
git add signage-engine/src/renderer/layout-manager.ts
git add -A
git commit -m "feat(signage): add LayoutManager with two-block layout, footer, and rotation"
```

---

### Task 8: Create Block Factory

**Files:**
- Create: `signage-engine/src/renderer/blocks/block-factory.ts`

**Step 1: Write block factory**

Maps `SignageBlock` config to concrete block instances.

```typescript
import { SignageBlock } from '../../data/fetchers/blocks-config';
import { BaseBlock } from './base-block';
import { POHighlightBlock } from './po-highlight';
import { ProjectsInvoicedBlock } from './projects-invoiced';
import { QuickStatsBlock } from './quick-stats';
import { RichTextBlock } from './rich-text';
import { PictureBlock } from './picture';

export function createBlock(config: SignageBlock): BaseBlock {
  switch (config.block_type) {
    case 'po-highlight':
      return new POHighlightBlock(config.title);
    case 'projects-invoiced':
      return new ProjectsInvoicedBlock(config.title);
    case 'quick-stats':
      return new QuickStatsBlock(config.title);
    case 'rich-text':
      return new RichTextBlock(config.title, config.content);
    case 'picture':
      return new PictureBlock(config.title, config.content);
    default:
      return new QuickStatsBlock(config.title || 'Quick Stats');
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/renderer/blocks/block-factory.ts
git commit -m "feat(signage): add block factory for creating block instances from config"
```

---

### Task 9: Implement Quick Stats Block

**Files:**
- Create: `signage-engine/src/renderer/blocks/quick-stats.ts`

**Step 1: Write Quick Stats block**

Displays 4 KPI cards in a 2x2 grid:
- Active project count
- Projects invoiced this month
- Monthly sales
- Quarterly sales % reached

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block';
import { COLORS } from '../components/colors';
import { drawText } from '../components/text';
import { formatCurrency, formatPercent } from '../components/format';

export class QuickStatsBlock extends BaseBlock {
  constructor(title: string) {
    super('quick-stats', title);
  }

  renderContent(ctx: SKRSContext2D, bounds: BlockBounds, data: Record<string, unknown>): void {
    const projects = (data.projects as any[]) || [];
    const invoicedProjects = (data.invoicedProjects as any[]) || [];
    const revenue = data.revenue as any;

    const stats = [
      { label: 'Active Projects', value: String(projects.length), color: COLORS.primary },
      { label: 'Invoiced This Month', value: String(invoicedProjects.length), color: COLORS.success },
      { label: 'Sales This Month', value: formatCurrency(revenue?.currentMonthRevenue || 0), color: COLORS.chartPrimary || COLORS.primary },
      { label: 'Quarterly Sales', value: formatPercent(revenue?.quarterGoal ? (revenue.quarterRevenue / revenue.quarterGoal) : 0), color: COLORS.accent || COLORS.coral },
    ];

    const cardGap = 40;
    const cols = 2;
    const rows = 2;
    const cardWidth = (bounds.width - cardGap) / cols;
    const cardHeight = (bounds.height - cardGap) / rows;

    stats.forEach((stat, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = bounds.x + col * (cardWidth + cardGap);
      const y = bounds.y + row * (cardHeight + cardGap);

      // Card background (light gray)
      ctx.fillStyle = '#F8F9FA';
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 16);
      ctx.fill();

      // Value (large, centered)
      drawText(ctx, stat.value, x + cardWidth / 2, y + cardHeight / 2 - 10, {
        font: 'Inter',
        size: BaseBlock.FONT.LARGE_VALUE,
        weight: '800',
        color: stat.color,
        align: 'center',
      });

      // Label (below value)
      drawText(ctx, stat.label, x + cardWidth / 2, y + cardHeight / 2 + 50, {
        font: 'Inter',
        size: BaseBlock.FONT.LABEL,
        weight: '500',
        color: '#6B7280',
        align: 'center',
      });
    });
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/renderer/blocks/quick-stats.ts
git commit -m "feat(signage): add Quick Stats block with 4 KPI cards"
```

---

### Task 10: Implement PO Highlight Block

**Files:**
- Create: `signage-engine/src/renderer/blocks/po-highlight.ts`

**Step 1: Write PO Highlight block**

Shows 4 POs in a vertical list: 2 largest + 2 newest this month. Each row shows PO number, client, amount, and a badge for "Largest" or "Newest".

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block';
import { COLORS } from '../components/colors';
import { drawText, truncateText } from '../components/text';
import { formatCurrency } from '../components/format';

export class POHighlightBlock extends BaseBlock {
  constructor(title: string) {
    super('po-highlight', title);
  }

  renderContent(ctx: SKRSContext2D, bounds: BlockBounds, data: Record<string, unknown>): void {
    const pos = (data.pos as any[]) || [];
    if (pos.length === 0) {
      drawText(ctx, 'No POs this month', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '500', color: '#9CA3AF', align: 'center',
      });
      return;
    }

    const rowHeight = bounds.height / 4;

    pos.slice(0, 4).forEach((po, i) => {
      const y = bounds.y + i * rowHeight;

      // Alternating subtle background
      if (i % 2 === 0) {
        ctx.fillStyle = '#F8F9FA';
        ctx.beginPath();
        ctx.roundRect(bounds.x, y + 4, bounds.width, rowHeight - 8, 12);
        ctx.fill();
      }

      const centerY = y + rowHeight / 2;

      // Badge (Largest / Newest)
      const badge = po.highlight_reason === 'largest' ? 'LARGEST' : 'NEWEST';
      const badgeColor = po.highlight_reason === 'largest' ? COLORS.coral : COLORS.primary;
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(bounds.x + 16, centerY - 16, 120, 32, 8);
      ctx.fill();
      drawText(ctx, badge, bounds.x + 76, centerY + 2, {
        font: 'Inter', size: 22, weight: '700', color: '#FFFFFF', align: 'center',
      });

      // PO number + client
      const poLabel = truncateText(ctx, `${po.po_number} — ${po.client_name}`, bounds.width - 400, 'Inter', BaseBlock.FONT.BODY);
      drawText(ctx, poLabel, bounds.x + 156, centerY - 12, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '600', color: COLORS.primary, align: 'left',
      });

      // Project name (smaller, below)
      if (po.project_name) {
        const projLabel = truncateText(ctx, po.project_name, bounds.width - 400, 'Inter', BaseBlock.FONT.SMALL);
        drawText(ctx, projLabel, bounds.x + 156, centerY + 22, {
          font: 'Inter', size: BaseBlock.FONT.SMALL, weight: '400', color: '#6B7280', align: 'left',
        });
      }

      // Amount (right aligned)
      drawText(ctx, formatCurrency(po.amount), bounds.x + bounds.width - 16, centerY, {
        font: 'Inter', size: BaseBlock.FONT.VALUE, weight: '800', color: COLORS.primary, align: 'right',
      });
    });
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/renderer/blocks/po-highlight.ts
git commit -m "feat(signage): add PO Highlight block showing largest and newest POs"
```

---

### Task 11: Implement Projects Invoiced Block

**Files:**
- Create: `signage-engine/src/renderer/blocks/projects-invoiced.ts`

**Step 1: Write Projects Invoiced block**

Shows latest 4 invoiced/completed projects in a vertical list with project name, client, and value.

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block';
import { COLORS } from '../components/colors';
import { drawText, truncateText } from '../components/text';
import { formatCurrency } from '../components/format';

export class ProjectsInvoicedBlock extends BaseBlock {
  constructor(title: string) {
    super('projects-invoiced', title);
  }

  renderContent(ctx: SKRSContext2D, bounds: BlockBounds, data: Record<string, unknown>): void {
    const projects = (data.invoicedProjects as any[]) || [];
    if (projects.length === 0) {
      drawText(ctx, 'No invoiced projects', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '500', color: '#9CA3AF', align: 'center',
      });
      return;
    }

    const rowHeight = bounds.height / 4;

    projects.slice(0, 4).forEach((project, i) => {
      const y = bounds.y + i * rowHeight;

      // Alternating background
      if (i % 2 === 0) {
        ctx.fillStyle = '#F8F9FA';
        ctx.beginPath();
        ctx.roundRect(bounds.x, y + 4, bounds.width, rowHeight - 8, 12);
        ctx.fill();
      }

      const centerY = y + rowHeight / 2;

      // Checkmark icon (green circle)
      ctx.fillStyle = COLORS.success;
      ctx.beginPath();
      ctx.arc(bounds.x + 36, centerY, 20, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, '✓', bounds.x + 36, centerY + 2, {
        font: 'Inter', size: 24, weight: '700', color: '#FFFFFF', align: 'center',
      });

      // Project name
      const name = truncateText(ctx, project.name, bounds.width - 350, 'Inter', BaseBlock.FONT.BODY);
      drawText(ctx, name, bounds.x + 76, centerY - 12, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '600', color: COLORS.primary, align: 'left',
      });

      // Client name
      const client = truncateText(ctx, project.client_name || '', bounds.width - 350, 'Inter', BaseBlock.FONT.SMALL);
      drawText(ctx, client, bounds.x + 76, centerY + 22, {
        font: 'Inter', size: BaseBlock.FONT.SMALL, weight: '400', color: '#6B7280', align: 'left',
      });

      // Value (right aligned)
      drawText(ctx, formatCurrency(project.total_value), bounds.x + bounds.width - 16, centerY, {
        font: 'Inter', size: BaseBlock.FONT.VALUE, weight: '800', color: COLORS.success, align: 'right',
      });
    });
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/renderer/blocks/projects-invoiced.ts
git commit -m "feat(signage): add Projects Invoiced block showing latest completed projects"
```

---

### Task 12: Implement Rich Text Block

**Files:**
- Create: `signage-engine/src/renderer/blocks/rich-text.ts`

**Step 1: Write Rich Text block**

Renders admin-entered formatted text. Content JSONB stores a simple structure:

```json
{
  "body": [
    { "type": "heading", "text": "Section Title" },
    { "type": "paragraph", "text": "Regular text with **bold** and *italic* support." },
    { "type": "bullet", "text": "A bullet point item" }
  ]
}
```

Canvas rendering parses inline **bold** and *italic* markers.

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block';
import { COLORS } from '../components/colors';
import { drawText, drawTextWrapped } from '../components/text';

interface RichTextNode {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
}

export class RichTextBlock extends BaseBlock {
  private body: RichTextNode[];

  constructor(title: string, content: Record<string, unknown>) {
    super('rich-text', title);
    this.body = (content.body as RichTextNode[]) || [];
  }

  renderContent(ctx: SKRSContext2D, bounds: BlockBounds): void {
    if (this.body.length === 0) {
      drawText(ctx, 'No content', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '400', color: '#9CA3AF', align: 'center',
      });
      return;
    }

    let cursorY = bounds.y;

    for (const node of this.body) {
      if (cursorY > bounds.y + bounds.height - 40) break;

      switch (node.type) {
        case 'heading': {
          cursorY += 20;
          drawText(ctx, this.stripFormatting(node.text), bounds.x, cursorY + 44, {
            font: 'Inter', size: BaseBlock.FONT.VALUE, weight: '700', color: COLORS.primary, align: 'left',
          });
          cursorY += 64;
          break;
        }
        case 'paragraph': {
          const lines = this.wrapText(ctx, this.stripFormatting(node.text), bounds.width, BaseBlock.FONT.BODY);
          for (const line of lines) {
            if (cursorY > bounds.y + bounds.height - 40) break;
            drawText(ctx, line, bounds.x, cursorY + 40, {
              font: 'Inter', size: BaseBlock.FONT.BODY, weight: '400', color: '#374151', align: 'left',
            });
            cursorY += 52;
          }
          cursorY += 16;
          break;
        }
        case 'bullet': {
          const bulletLines = this.wrapText(ctx, this.stripFormatting(node.text), bounds.width - 48, BaseBlock.FONT.BODY);
          for (let j = 0; j < bulletLines.length; j++) {
            if (cursorY > bounds.y + bounds.height - 40) break;
            if (j === 0) {
              // Draw bullet dot
              ctx.fillStyle = COLORS.primary;
              ctx.beginPath();
              ctx.arc(bounds.x + 12, cursorY + 34, 8, 0, Math.PI * 2);
              ctx.fill();
            }
            drawText(ctx, bulletLines[j], bounds.x + 40, cursorY + 40, {
              font: 'Inter', size: BaseBlock.FONT.BODY, weight: '400', color: '#374151', align: 'left',
            });
            cursorY += 52;
          }
          cursorY += 8;
          break;
        }
      }
    }
  }

  private stripFormatting(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
  }

  private wrapText(ctx: SKRSContext2D, text: string, maxWidth: number, fontSize: number): string[] {
    ctx.font = `400 ${fontSize}px Inter`;
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
}
```

**Step 2: Commit**

```bash
git add signage-engine/src/renderer/blocks/rich-text.ts
git commit -m "feat(signage): add Rich Text block with headings, paragraphs, and bullets"
```

---

### Task 13: Implement Picture Block

**Files:**
- Create: `signage-engine/src/renderer/blocks/picture.ts`
- Create: `signage-engine/src/data/fetchers/images.ts`

**Step 1: Write image fetcher/cache**

```typescript
// images.ts
import { loadImage } from '@napi-rs/canvas';
import type { Image } from '@napi-rs/canvas';
import { logger } from '../../utils/logger';

const imageCache = new Map<string, Image>();

export async function getCachedImage(url: string): Promise<Image | null> {
  if (imageCache.has(url)) return imageCache.get(url)!;

  try {
    const img = await loadImage(url);
    imageCache.set(url, img);
    return img;
  } catch (error) {
    logger.error({ error, url }, 'Failed to load image');
    return null;
  }
}

export function clearImageCache(): void {
  imageCache.clear();
}
```

**Step 2: Write Picture block**

Content JSONB: `{ "image_url": "https://...", "fit": "contain" | "cover" }`

```typescript
import type { SKRSContext2D } from '@napi-rs/canvas';
import { BaseBlock, BlockBounds } from './base-block';
import { drawText } from '../components/text';
import { getCachedImage } from '../../data/fetchers/images';

export class PictureBlock extends BaseBlock {
  private imageUrl: string;
  private imageLoaded: boolean = false;
  private imageObj: any = null;

  constructor(title: string, content: Record<string, unknown>) {
    super('picture', title);
    this.imageUrl = (content.image_url as string) || '';
    this.loadImageAsync();
  }

  private async loadImageAsync(): Promise<void> {
    if (!this.imageUrl) return;
    const img = await getCachedImage(this.imageUrl);
    if (img) {
      this.imageObj = img;
      this.imageLoaded = true;
    }
  }

  renderContent(ctx: SKRSContext2D, bounds: BlockBounds): void {
    if (!this.imageUrl) {
      drawText(ctx, 'No image set', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '400', color: '#9CA3AF', align: 'center',
      });
      return;
    }

    if (!this.imageLoaded) {
      drawText(ctx, 'Loading...', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
        font: 'Inter', size: BaseBlock.FONT.BODY, weight: '400', color: '#9CA3AF', align: 'center',
      });
      return;
    }

    // Fit image within bounds (contain mode)
    const imgRatio = this.imageObj.width / this.imageObj.height;
    const boundsRatio = bounds.width / bounds.height;

    let drawWidth: number, drawHeight: number;
    if (imgRatio > boundsRatio) {
      drawWidth = bounds.width;
      drawHeight = bounds.width / imgRatio;
    } else {
      drawHeight = bounds.height;
      drawWidth = bounds.height * imgRatio;
    }

    const drawX = bounds.x + (bounds.width - drawWidth) / 2;
    const drawY = bounds.y + (bounds.height - drawHeight) / 2;

    ctx.drawImage(this.imageObj, drawX, drawY, drawWidth, drawHeight);
  }
}
```

**Step 3: Commit**

```bash
git add signage-engine/src/renderer/blocks/picture.ts signage-engine/src/data/fetchers/images.ts
git commit -m "feat(signage): add Picture block with image caching"
```

---

### Task 14: Update Engine Main Loop (index.ts)

**Files:**
- Modify: `signage-engine/src/index.ts`

**Step 1: Replace SlideManager with LayoutManager**

Update imports, initialization, and the render frame function:
- Remove: `import { SlideManager }` and all references
- Add: `import { LayoutManager }`
- In `start()`: create `LayoutManager(config.display.width, config.display.height)` instead of `SlideManager`
- In `renderFrame()`: call `layoutManager.render(ctx, dataCache, deltaTime)` instead of `slideManager.render()`
- Config reload: call `layoutManager.updateConfig(blocksConfig.blocks, blocksConfig.settings)` instead of `slideManager.reloadFromDatabase()`
- Update `EngineState` to use `layoutManager` instead of `slideManager`

**Step 2: Update API server references**

In `signage-engine/src/api/server.ts`:
- Update `/status` endpoint — remove slideManager-specific fields (currentSlide index), add block info
- Remove `/control/slide/:index` endpoint (no longer applicable)
- Keep all other endpoints

**Step 3: Commit**

```bash
git add signage-engine/src/index.ts signage-engine/src/api/server.ts
git commit -m "feat(signage): wire LayoutManager into engine main loop and API"
```

---

### Task 15: Update Config Schema

**Files:**
- Modify: `signage-engine/src/config/schema.ts`

**Step 1: Remove old slide config schema, simplify**

- Remove `SlideConfigSchema` (no longer needed, blocks come from DB)
- Keep: NDI, Display, Polling (update intervals), Transition, API, Debug schemas
- Update `PollingConfigSchema` to remove schedule/metrics/dashboardMetrics intervals, add invoicedProjects and blocksConfig intervals

**Step 2: Commit**

```bash
git add signage-engine/src/config/schema.ts
git commit -m "chore(signage): simplify config schema for new block system"
```

---

### Task 16: Rewrite Admin UI — Server Actions

**Files:**
- Modify: `src/app/(dashboard)/admin/signage/actions.ts`

**Step 1: Replace old CRUD actions with new ones**

Remove: `getSlides`, `createSlide`, `updateSlide`, `deleteSlide`, `reorderSlides`, `updateAllSlideDurations`

Add:
- `getBlocks()` — fetch all from signage_blocks ordered by display_order
- `createBlock(block)` — insert new block with auto display_order
- `updateBlock(id, updates)` — partial update (title, content, enabled, position, display_order)
- `deleteBlock(id)` — delete by id
- `reorderBlocks(blockIds)` — bulk update display_order
- `getSignageSettings()` — fetch single settings row
- `updateSignageSettings(settings)` — update rotation_interval_ms
- `uploadSignageImage(formData)` — upload to signage-images bucket, return public URL

Keep: `getSignageStatus`, `startSignageEngine`, `stopSignageEngine`, `restartSignageEngine`, `fetchAPI` helper

**Step 2: Commit**

```bash
git add src/app/(dashboard)/admin/signage/actions.ts
git commit -m "feat(signage): rewrite server actions for new block system"
```

---

### Task 17: Rewrite Admin UI — Page & Block Editor

**Files:**
- Modify: `src/app/(dashboard)/admin/signage/page.tsx`
- Rewrite: `src/components/signage/slide-editor.tsx` → `src/components/signage/block-editor.tsx`

**Step 1: Create BlockEditor component**

Replace `slide-editor.tsx` with `block-editor.tsx`. Features:
- List all blocks with:
  - Enable/disable toggle
  - Position selector (left / right / both)
  - Drag handle for reorder
  - Edit button (opens edit dialog)
  - Delete button
- "Add Block" button opens dialog to select type + fill content
- For `rich-text` type: simple text editor with buttons for heading/paragraph/bullet
- For `picture` type: image upload field + preview
- For data-driven types (po-highlight, projects-invoiced, quick-stats): just title + position, no content editing
- Settings section: rotation interval input (in seconds, converted to ms)

Use existing shadcn/ui components: Dialog, Button, Input, Select, Switch, Textarea, Label, Card.

**Step 2: Update admin page**

- Remove old Slides tab content
- Remove Logs tab
- Keep engine controls (Start/Stop/Restart, status, preview)
- Add Blocks tab using new BlockEditor
- Add Settings section with rotation interval

**Step 3: Delete old slide-editor.tsx**

```bash
rm src/components/signage/slide-editor.tsx
```

**Step 4: Commit**

```bash
git add src/components/signage/block-editor.tsx src/app/(dashboard)/admin/signage/page.tsx
git add -A
git commit -m "feat(signage): rewrite admin UI with block editor, image upload, and settings"
```

---

### Task 18: Add Logo Asset

**Files:**
- Create: `signage-engine/assets/logo.png`

**Step 1: Ensure amitrace logo exists**

Check if there's already a logo in the project. If so, copy it to `signage-engine/assets/logo.png`. If not, create a placeholder. The LayoutManager references `assets/logo.png` for the footer.

Look in: `public/`, `src/`, any existing asset directories.

**Step 2: Commit**

```bash
git add signage-engine/assets/
git commit -m "chore(signage): add logo asset for footer"
```

---

### Task 19: Verify Engine Compiles & Starts

**Step 1: Check TypeScript compilation**

```bash
cd signage-engine && npx tsc --noEmit
```

Fix any import errors, missing references, or type mismatches.

**Step 2: Verify engine starts**

```bash
cd signage-engine && npm run dev
```

Check that:
- No crash on startup
- Preview endpoint returns a PNG at `http://localhost:3001/preview`
- Two-block layout visible in preview
- Footer shows time and date

**Step 3: Fix any issues found**

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(signage): resolve compilation and runtime issues"
```

---

### Task 20: Verify Admin UI Works

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Navigate to admin page**

Visit `http://localhost:3000/admin/signage`. Verify:
- Engine status displays correctly
- Block list loads from database
- Can add a new rich-text block with content
- Can add a new picture block with image upload
- Can toggle blocks on/off
- Can change block position (left/right/both)
- Can reorder blocks
- Can change rotation interval
- Preview shows the two-block layout

**Step 3: Fix any issues found**

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(signage): resolve admin UI issues"
```

---

### Task 21: Final Cleanup

**Step 1: Remove any remaining dead imports/references**

Search the codebase for references to old slide types, `SlideManager`, `signage_slides`, `slide-config`, etc. Remove dead code.

**Step 2: Update CLAUDE.md if needed**

Add a section about the new signage block system if significant enough.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore(signage): final cleanup of old signage references"
```
