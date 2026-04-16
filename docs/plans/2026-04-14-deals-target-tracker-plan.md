# Deals Target Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the Upcoming Deals page with a stacked progress bar tracker, slipped deals callout, win rate, earlier-stage deals indicator, and monthly/quarterly toggle.

**Architecture:** Enhance existing components in `src/components/deals/` and the deals API route. Add a new server action for querying received POs from the projects table. Extend the AC deals API to optionally fetch deals from all pipeline stages. No database migrations needed.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase, ActiveCampaign REST API.

---

## Task 1: Server Action — Get Received POs

Create a server action that queries the `projects` table for POs received in a given date range.

**Files:**
- Create: `src/app/(dashboard)/upcoming-deals/actions.ts`
- Test: `src/app/(dashboard)/upcoming-deals/__tests__/actions.test.ts`

**Step 1: Write the failing test**

Create `src/app/(dashboard)/upcoming-deals/__tests__/actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn();
const mockNot = vi.fn();
const mockGte = vi.fn();
const mockLt = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}));

import { getReceivedPOs } from '../actions';

describe('getReceivedPOs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Chain: from('projects').select(...).not('po_number', 'is', null).gte('created_date', ...).lt('created_date', ...)
    mockSelect.mockReturnValue({ not: mockNot });
    mockNot.mockReturnValue({ gte: mockGte });
    mockGte.mockReturnValue({ lt: mockLt });
  });

  it('returns aggregated PO data for a month', async () => {
    mockLt.mockResolvedValue({
      data: [
        { id: '1', sales_amount: 50000, created_date: '2026-04-05' },
        { id: '2', sales_amount: 80000, created_date: '2026-04-12' },
      ],
      error: null,
    });

    const result = await getReceivedPOs('2026-04');
    expect(result).toEqual({
      totalValue: 130000,
      count: 2,
      projects: [
        { id: '1', sales_amount: 50000, created_date: '2026-04-05' },
        { id: '2', sales_amount: 80000, created_date: '2026-04-12' },
      ],
    });

    expect(mockFrom).toHaveBeenCalledWith('projects');
    expect(mockNot).toHaveBeenCalledWith('po_number', 'is', null);
    expect(mockGte).toHaveBeenCalledWith('created_date', '2026-04-01');
    expect(mockLt).toHaveBeenCalledWith('created_date', '2026-05-01');
  });

  it('returns zeros when no POs found', async () => {
    mockLt.mockResolvedValue({ data: [], error: null });

    const result = await getReceivedPOs('2026-04');
    expect(result).toEqual({ totalValue: 0, count: 0, projects: [] });
  });

  it('returns zeros on Supabase error', async () => {
    mockLt.mockResolvedValue({ data: null, error: { message: 'fail' } });

    const result = await getReceivedPOs('2026-04');
    expect(result).toEqual({ totalValue: 0, count: 0, projects: [] });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/\(dashboard\)/upcoming-deals/__tests__/actions.test.ts`
Expected: FAIL — `getReceivedPOs` not found

**Step 3: Write minimal implementation**

Create `src/app/(dashboard)/upcoming-deals/actions.ts`:

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';

export interface ReceivedPOData {
  totalValue: number;
  count: number;
  projects: Array<{ id: string; sales_amount: number; created_date: string }>;
}

/**
 * Query projects table for POs received in a given month (YYYY-MM format).
 * Uses created_date (user-editable PO received date) as the date field.
 */
export async function getReceivedPOs(monthKey: string): Promise<ReceivedPOData> {
  try {
    const supabase = await createClient();
    const [year, month] = monthKey.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('projects')
      .select('id, sales_amount, created_date')
      .not('po_number', 'is', null)
      .gte('created_date', startDate)
      .lt('created_date', endDate);

    if (error || !data) {
      console.error('Failed to fetch received POs:', error);
      return { totalValue: 0, count: 0, projects: [] };
    }

    const totalValue = data.reduce((sum, p) => sum + (p.sales_amount || 0), 0);
    return { totalValue, count: data.length, projects: data as ReceivedPOData['projects'] };
  } catch (err) {
    console.error('getReceivedPOs error:', err);
    return { totalValue: 0, count: 0, projects: [] };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/\(dashboard\)/upcoming-deals/__tests__/actions.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/upcoming-deals/actions.ts src/app/\(dashboard\)/upcoming-deals/__tests__/actions.test.ts
git commit -m "feat(deals): add getReceivedPOs server action for PO tracking"
```

---

## Task 2: Extend AC Deals API — Support All Stages

Extend `GET /api/activecampaign/deals` to accept `?stages=all` and return deals from all stages in the Solutions pipeline (not just Verbal Commit), including the stage name on each deal.

**Files:**
- Modify: `src/app/api/activecampaign/deals/route.ts`
- Modify: `src/types/activecampaign.ts` (add `stageName` to `ACDealDisplay`)

**Step 1: Add `stageName` to `ACDealDisplay` type**

In `src/types/activecampaign.ts:96-102`, change:

```typescript
export interface ACDealDisplay extends ACDeal {
  contactName: string;
  accountName: string;
  dealUrl: string;
  forecastCloseDate: string;
  hasConfirmedPO: boolean;
  stageName: string;  // ADD THIS
}
```

**Step 2: Modify the deals API route**

In `src/app/api/activecampaign/deals/route.ts`, modify the `GET` handler:

1. Read `?stages=all` from the URL search params
2. If `stages=all`, fetch all stages for the pipeline and get deals from each stage
3. Include `stageName` on each resolved deal
4. Return the combined result

Key changes to `route.ts`:

```typescript
// At the top of the GET handler, after auth check:
const { searchParams } = new URL(request.url);
const fetchAllStages = searchParams.get('stages') === 'all';

// Change the GET signature:
export async function GET(request: Request) {
```

When `fetchAllStages` is true:
- Fetch all stages for the pipeline (already have `stages` array)
- Get deals from each stage (not just Verbal Commit)
- Include `stage.title` as `stageName` on each deal

When `fetchAllStages` is false (default):
- Current behavior unchanged — only Verbal Commit stage

On each resolved deal, add: `stageName: currentStageName` (where `currentStageName` comes from the matched stage title).

**Step 3: Run existing tests to verify no regression**

Run: `npm test`
Expected: All existing tests pass

**Step 4: Commit**

```bash
git add src/app/api/activecampaign/deals/route.ts src/types/activecampaign.ts
git commit -m "feat(deals): extend AC deals API to support all pipeline stages"
```

---

## Task 3: View Toggle Component

Create a simple monthly/quarterly toggle button group.

**Files:**
- Create: `src/components/deals/view-toggle.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { Button } from '@/components/ui/button';

type ViewMode = 'monthly' | 'quarterly';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border">
      <Button
        variant={mode === 'monthly' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-r-none text-xs"
        onClick={() => onChange('monthly')}
      >
        Monthly
      </Button>
      <Button
        variant={mode === 'quarterly' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-l-none text-xs"
        onClick={() => onChange('quarterly')}
      >
        Quarterly
      </Button>
    </div>
  );
}

export type { ViewMode };
```

**Step 2: Commit**

```bash
git add src/components/deals/view-toggle.tsx
git commit -m "feat(deals): add monthly/quarterly view toggle component"
```

---

## Task 4: Target Tracker Card (Enhanced Hero)

Replace `MonthHeroCard` with `TargetTrackerCard` — stacked progress bar with three stat cards.

**Files:**
- Create: `src/components/deals/target-tracker-card.tsx`
- Keep: `src/components/deals/month-hero-card.tsx` (delete later after wiring)

**Step 1: Create the component**

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, MessageSquare, Target } from 'lucide-react';

interface TargetTrackerCardProps {
  periodLabel: string;           // "April 2026" or "Q2 2026"
  goal: number;                  // dollars
  receivedPOValue: number;       // from projects table
  receivedPOCount: number;
  verbalCommitValue: number;     // from AC deals
  verbalCommitCount: number;
}

export function TargetTrackerCard({
  periodLabel,
  goal,
  receivedPOValue,
  receivedPOCount,
  verbalCommitValue,
  verbalCommitCount,
}: TargetTrackerCardProps) {
  const totalValue = receivedPOValue + verbalCommitValue;
  const percentage = goal > 0 ? Math.round((totalValue / goal) * 100) : 0;
  const gap = goal - totalValue;

  // Stacked bar segment widths (as % of goal)
  const poPercent = goal > 0 ? Math.min((receivedPOValue / goal) * 100, 100) : 0;
  const verbalPercent = goal > 0 ? Math.min((verbalCommitValue / goal) * 100, 100 - poPercent) : 0;

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  const hasGoal = goal > 0;
  const GapIcon = gap <= 0 ? TrendingUp : gap === totalValue ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {periodLabel} — Target Tracker
          </h2>
          {hasGoal && (
            <div className="flex items-center gap-1.5 text-sm">
              <GapIcon className="h-3.5 w-3.5" />
              <span className={gap <= 0 ? 'text-green-600' : 'text-red-600'}>
                {gap <= 0 ? '+' : '-'}{formatValue(Math.abs(gap))} {gap <= 0 ? 'over' : 'short'}
              </span>
            </div>
          )}
        </div>

        {/* Main value + progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-2xl font-bold">{formatValue(totalValue)}</span>
              {hasGoal && (
                <span className="text-muted-foreground"> of {formatValue(goal)} goal</span>
              )}
            </span>
            {hasGoal && <span className="text-muted-foreground">{percentage}%</span>}
          </div>

          {/* Stacked progress bar */}
          {hasGoal && (
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex">
              {poPercent > 0 && (
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${poPercent}%` }}
                  title={`POs Received: ${formatValue(receivedPOValue)}`}
                />
              )}
              {verbalPercent > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${verbalPercent}%` }}
                  title={`Verbal Commits: ${formatValue(verbalCommitValue)}`}
                />
              )}
              {/* Remaining gap is the bg-muted showing through */}
            </div>
          )}

          {/* Legend */}
          {hasGoal && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" /> POs Received
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" /> Verbal Commits
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted border" /> Gap
              </span>
            </div>
          )}
        </div>

        {/* Three stat cards */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              POs Received
            </div>
            <p className="text-lg font-semibold">{formatValue(receivedPOValue)}</p>
            <p className="text-xs text-muted-foreground">{receivedPOCount} project{receivedPOCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
              Verbal Commits
            </div>
            <p className="text-lg font-semibold">{formatValue(verbalCommitValue)}</p>
            <p className="text-xs text-muted-foreground">{verbalCommitCount} deal{verbalCommitCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              Gap to Goal
            </div>
            <p className={`text-lg font-semibold ${gap <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {gap <= 0 ? 'Met!' : formatValue(gap)}
            </p>
            {hasGoal && gap > 0 && (
              <p className="text-xs text-muted-foreground">{100 - percentage}% remaining</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/deals/target-tracker-card.tsx
git commit -m "feat(deals): add TargetTrackerCard with stacked progress bar"
```

---

## Task 5: Slipped Deals Callout

Create the slipped deals warning component.

**Files:**
- Create: `src/components/deals/slipped-deals-callout.tsx`

**Step 1: Create the component**

The component receives deals and filters for those with `forecastCloseDate` > 14 days past. Shows an amber warning card with a table of slipped deals sorted by days overdue.

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

const SLIP_THRESHOLD_DAYS = 14;
const MAX_DISPLAY = 10;

interface SlippedDealsCalloutProps {
  deals: ACDealDisplay[];
}

export function SlippedDealsCallout({ deals }: SlippedDealsCalloutProps) {
  const today = new Date();

  const slippedDeals = deals
    .filter((d) => {
      if (!d.forecastCloseDate) return false;
      const closeDate = parseISO(d.forecastCloseDate);
      return differenceInDays(today, closeDate) > SLIP_THRESHOLD_DAYS;
    })
    .map((d) => ({
      ...d,
      daysOverdue: differenceInDays(today, parseISO(d.forecastCloseDate)),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (slippedDeals.length === 0) return null;

  const totalValue = slippedDeals.reduce((sum, d) => sum + parseInt(d.value, 10) / 100, 0);
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  const displayed = slippedDeals.slice(0, MAX_DISPLAY);
  const hasMore = slippedDeals.length > MAX_DISPLAY;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Slipped Deals ({slippedDeals.length} deal{slippedDeals.length !== 1 ? 's' : ''}, {formatValue(totalValue)})
        </div>
        <table className="w-full text-sm">
          <tbody>
            {displayed.map((deal) => (
              <tr key={deal.id} className="border-b border-amber-200/50 last:border-0">
                <td className="py-1.5 pr-3">
                  <a
                    href={deal.dealUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {deal.title}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">{deal.accountName || '\u2014'}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {format(parseISO(deal.forecastCloseDate), 'MMM d')}
                </td>
                <td className="py-1.5 pr-3 text-amber-600 font-medium">{deal.daysOverdue}d late</td>
                <td className="py-1.5 text-right">{formatValue(parseInt(deal.value, 10) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <p className="text-xs text-muted-foreground">
            + {slippedDeals.length - MAX_DISPLAY} more slipped deals
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/deals/slipped-deals-callout.tsx
git commit -m "feat(deals): add slipped deals callout component"
```

---

## Task 6: Earlier-Stage Deals Callout

Create the component showing deals in pre-Verbal-Commit stages with forecast close date in current month.

**Files:**
- Create: `src/components/deals/earlier-stage-callout.tsx`

**Step 1: Create the component**

Receives all-stage deals (from the `?stages=all` API), filters for those NOT in Verbal Commit stage with forecast close date in the current month.

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowUpRight, ChevronRight, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

interface EarlierStageCalloutProps {
  deals: ACDealDisplay[];        // All-stage deals
  currentMonthKey: string;       // "2026-04"
  verbalCommitStageName?: string; // "Verbal Commit"
}

export function EarlierStageCallout({
  deals,
  currentMonthKey,
  verbalCommitStageName = 'Verbal Commit',
}: EarlierStageCalloutProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter: not in Verbal Commit stage, has forecast close in current month
  const earlierDeals = deals.filter((d) => {
    if (!d.forecastCloseDate) return false;
    if (d.stageName?.toLowerCase() === verbalCommitStageName.toLowerCase()) return false;
    return d.forecastCloseDate.startsWith(currentMonthKey);
  });

  if (earlierDeals.length === 0) return null;

  const totalValue = earlierDeals.reduce((sum, d) => sum + parseInt(d.value, 10) / 100, 0);
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardContent className="p-4 flex items-center gap-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {earlierDeals.length} deal{earlierDeals.length !== 1 ? 's' : ''} ({formatValue(totalValue)}) in earlier stages need to reach Verbal Commit
              </span>
              <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </CardContent>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-1.5 font-medium">Deal</th>
                  <th className="pb-1.5 font-medium">Stage</th>
                  <th className="pb-1.5 font-medium">Account</th>
                  <th className="pb-1.5 font-medium text-right">Value</th>
                  <th className="pb-1.5 font-medium text-right">Close</th>
                </tr>
              </thead>
              <tbody>
                {earlierDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-blue-200/50 last:border-0">
                    <td className="py-1.5 pr-3">
                      <a
                        href={deal.dealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {deal.title}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{deal.stageName}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{deal.accountName || '\u2014'}</td>
                    <td className="py-1.5 pr-3 text-right">{formatValue(parseInt(deal.value, 10) / 100)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {format(parseISO(deal.forecastCloseDate), 'MMM d')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/deals/earlier-stage-callout.tsx
git commit -m "feat(deals): add earlier-stage deals callout component"
```

---

## Task 7: Enhanced Pipeline Outlook with Win Rate + Quarterly Mode

Modify `PipelineOutlook` to support win rate column and quarterly grouping.

**Files:**
- Modify: `src/components/deals/pipeline-outlook.tsx`

**Step 1: Update the interfaces and component**

Add to `MonthSummary`:
```typescript
winRate: number | null; // 0-100, null for future months
```

Add new props:
```typescript
viewMode: 'monthly' | 'quarterly';
```

When `viewMode === 'quarterly'`:
- Group months into quarters (Q1=Jan-Mar, etc.)
- Show quarter header rows with aggregated values
- Show month rows indented beneath each quarter

Add win rate display: after the progress bar, show `Win XX%` for months that have a value, `\u2014` for future months.

**Step 2: Run all tests**

Run: `npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/components/deals/pipeline-outlook.tsx
git commit -m "feat(deals): add win rate column and quarterly mode to Pipeline Outlook"
```

---

## Task 8: Wire Everything Together in UpcomingDealsContent

Integrate all new components into the main page component.

**Files:**
- Modify: `src/components/deals/upcoming-deals-content.tsx`

**Step 1: Add imports and state**

Add imports for:
- `ViewToggle`, `ViewMode` from `./view-toggle`
- `TargetTrackerCard` from `./target-tracker-card`
- `SlippedDealsCallout` from `./slipped-deals-callout`
- `EarlierStageCallout` from `./earlier-stage-callout`
- `getReceivedPOs` from the new server action

Add state:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('monthly');
const [receivedPOs, setReceivedPOs] = useState<Map<string, { totalValue: number; count: number }>>(new Map());
const [allStageDeals, setAllStageDeals] = useState<ACDealDisplay[]>([]);
```

**Step 2: Fetch received POs + all-stage deals**

In the `useEffect`, add parallel fetches:
1. `getReceivedPOs` for each month that has deals (and current month even if no deals)
2. `fetch('/api/activecampaign/deals?stages=all')` for earlier-stage deals

**Step 3: Compute quarterly aggregations**

Add a `useMemo` that groups months into quarters when `viewMode === 'quarterly'`:
- Quarter key: `YYYY-QN` (e.g. `2026-Q2`)
- Aggregates: POs, verbal commits, goals, deal counts
- Current quarter: quarter containing the current month

**Step 4: Compute win rates**

For each month, compute:
```typescript
const poCount = receivedPOs.get(monthKey)?.count ?? 0;
const verbalCount = monthDeals.length;
const winRate = (poCount + verbalCount) > 0
  ? Math.round((poCount / (poCount + verbalCount)) * 100)
  : null;
```

Only show for current and past months.

**Step 5: Update the JSX**

Replace `MonthHeroCard` with `TargetTrackerCard`, passing `receivedPOValue` and `receivedPOCount` from the server action data.

Add `ViewToggle` to the header bar.

Add `SlippedDealsCallout` below the tracker card, passing all verbal commit deals.

Add `EarlierStageCallout` below slipped deals, passing `allStageDeals` and `currentMonth`.

Pass `viewMode` and `winRate` data to `PipelineOutlook`.

**Step 6: Run the dev server and verify**

Run: `npm run dev`
- Check monthly view: hero card shows stacked bar with POs + verbal + gap
- Check quarterly toggle: hero card aggregates to quarter
- Check slipped deals section appears for overdue deals
- Check earlier-stage callout shows non-VC deals
- Check Pipeline Outlook shows win rate for current/past months

**Step 7: Commit**

```bash
git add src/components/deals/upcoming-deals-content.tsx
git commit -m "feat(deals): wire up target tracker, slipped deals, earlier stages, and quarterly view"
```

---

## Task 9: Cleanup

Remove the old `MonthHeroCard` import and delete the file if it's no longer used elsewhere.

**Files:**
- Delete: `src/components/deals/month-hero-card.tsx` (verify no other imports first)

**Step 1: Verify no other imports**

Run: `grep -r "month-hero-card\|MonthHeroCard" src/`
Expected: Only the old import in `upcoming-deals-content.tsx` which was already replaced.

**Step 2: Delete and commit**

```bash
rm src/components/deals/month-hero-card.tsx
git add -u
git commit -m "chore(deals): remove deprecated MonthHeroCard component"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors (pre-existing errors in e2e/auth.spec.ts are OK)

**Step 3: Manual browser verification**

Run: `npm run dev` and check:
- [ ] Monthly view: stacked bar shows POs (green) + verbal (amber) + gap (gray)
- [ ] Three stat cards show correct values
- [ ] Slipped deals callout appears for overdue deals
- [ ] Earlier-stage callout is expandable
- [ ] Quarterly toggle aggregates correctly
- [ ] Pipeline Outlook shows win rate for current/past months
- [ ] Pipeline Outlook quarterly mode groups months under quarters
- [ ] Clicking months in Pipeline Outlook still scrolls to section
- [ ] Deals sections still expand/collapse correctly

**Step 4: Final commit if any fixes needed**
