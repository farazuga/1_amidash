# Simplify Digital Signage — Design

## Overview

Rewrite the digital signage content/display layer. Keep the existing infrastructure (canvas renderer, NDI output, polling, API server). Replace all 16 slide types with a clean two-block layout and 5 new block types. Add admin-editable custom content blocks (rich text, picture). Clean up old code.

## Layout

- **4K (3840x2160)** canvas
- Two equal rounded-rectangle blocks side by side (white interior, dark green #053B2C border)
- Small gap between blocks, padding from screen edges
- Persistent footer bar: left = live clock + day/date, right = amitrace logo
- Footer background: dark green (#053B2C)

## Block Rotation

- Each block (left/right) has its own ordered list of assigned content blocks
- Blocks cycle independently with fade transitions
- Default 15s rotation interval, configurable globally from admin

## Block Types (5 total)

| Type | Content | Data Source |
|---|---|---|
| PO Highlight | 2 largest POs this month + 2 newest POs (4 total). Shows PO number, client, amount | Supabase (purchase_orders) |
| Projects Invoiced | Latest 4 completed/invoiced projects. Shows project name, client, value | Supabase (projects) |
| Quick Stats | 4 KPI cards: active project count, projects invoiced this month, monthly sales, quarterly sales % | Supabase (projects, revenue) |
| Rich Text | Title + formatted body (headings, bullets, bold/italic). Admin-entered via web UI | Admin content |
| Picture | Title + uploaded image (scaled to fill block). Admin-uploaded via web UI | Supabase Storage |

## Database

### Drop

- `signage_slides` table (old)

### New: `signage_blocks`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, default gen_random_uuid() |
| block_type | TEXT | Enum: po-highlight, projects-invoiced, quick-stats, rich-text, picture |
| title | TEXT | Display name |
| content | JSONB | Rich text content, image URL, or null for data-driven types |
| enabled | BOOLEAN | Default true, controls rotation visibility |
| position | TEXT | left, right, or both |
| display_order | INTEGER | Rotation order within position |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Auto-updated via trigger |

### New: `signage_settings`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, single row |
| rotation_interval_ms | INTEGER | Default 15000 |
| updated_at | TIMESTAMPTZ | Auto-updated via trigger |

### Supabase Storage

- Bucket: `signage-images` for picture block uploads

## Engine Changes

### Delete

- All 16 slide files in `signage-engine/src/renderer/slides/`
- `base-slide.ts`
- Unused fetchers: metrics.ts, dashboard-metrics.ts
- Unused components: gauges.ts, charts.ts

### Keep

- `canvas-manager.ts` — double-buffered rendering
- `ndi/output.ts` — NDI sender
- `polling-manager.ts` — restructured for new data sources
- `api/server.ts` — control + preview endpoints
- `text.ts`, `colors.ts`, `format.ts` — rendering utilities
- Config system, logger, Supabase client

### New

- `base-block.ts` — abstract class, draws rounded rectangle + title, provides content area bounds
- `layout-manager.ts` — two-block layout, footer bar, clock, logo, independent rotation timers
- `po-highlight.ts` — PO highlight block
- `projects-invoiced.ts` — projects invoiced block
- `quick-stats.ts` — quick stats block
- `rich-text.ts` — rich text block (canvas text layout with formatting)
- `picture.ts` — picture block (image rendering)
- `blocks-config.ts` fetcher — fetches enabled blocks + settings
- `images.ts` fetcher — fetches and caches images from Supabase Storage

### Adjusted

- `pos.ts` fetcher — query for largest this month + newest
- `projects.ts` fetcher — filter for invoiced/completed
- `revenue.ts` fetcher — keep for sales data

## Admin UI

Existing `/admin/signage` page:

### Keep
- Engine controls (start/stop/restart, status, preview)

### Remove
- Old slide editor (SlideEditor component)
- Old log viewer and config sections

### Add
- **Blocks section:** list all blocks, toggle enable/disable, assign to left/right/both, drag to reorder, click to edit content, add new block (pick type + fill content)
- **Rich text editor** for rich-text blocks
- **Image upload** for picture blocks
- **Settings section:** rotation interval input
