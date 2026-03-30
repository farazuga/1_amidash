# Shared Metrics Library — Design & Implementation Scope

## Problem Statement

Sales data (revenue, PO counts, invoiced amounts, goals) is computed independently in 5+ locations across the codebase. Each location writes its own SQL queries, date filters, and aggregation logic. There are no shared definitions for what "sales this month" or "invoiced revenue" means, resulting in numbers that vary from place to place.

## Decision

**Approach A: Shared Metrics Library** — Create `src/lib/metrics/` with pure functions that define each metric calculation once. Every consumer imports and calls these functions.

The **dashboard homepage** (`src/components/dashboard/dashboard-content.tsx`) is the canonical source of truth for all metric definitions.

---

## Section 1: Canonical Metric Definitions

| Metric Key | Display Name | Definition | Date Field | Notes |
|---|---|---|---|---|
| `posReceivedRevenue` | POs Received ($) | `SUM(sales_amount)` WHERE `created_date` in period | `created_date` | User-editable PO received date, NOT `created_at` |
| `posReceivedCount` | POs Received (#) | `COUNT(*)` WHERE `created_date` in period | `created_date` | Same date field as revenue |
| `invoicedRevenue` | Invoiced Revenue ($) | `SUM(sales_amount)` WHERE `invoiced_date` in period | `invoiced_date` | Explicit invoiced date field, NOT `updated_at` |
| `invoicedCount` | Invoiced (#) | `COUNT(*)` WHERE `invoiced_date` in period | `invoiced_date` | Same date field as revenue |
| `activeProjectCount` | Active Projects | `COUNT(*)` WHERE status NOT IN (Invoiced, Cancelled) | n/a | Excludes Invoiced + Cancelled only. "Completed" = Invoiced (same thing). |
| `pipelineRevenue` | Pipeline Value ($) | `SUM(sales_amount)` of active projects | n/a | Uses same active filter as `activeProjectCount` |
| `avgDaysToInvoice` | Avg Days to Invoice | `AVG(invoiced_date - created_date)` for projects with both dates | `invoiced_date`, `created_date` | Simple date diff, NOT status_history lookup |
| `revenueGoal` | Revenue Goal ($) | From `revenue_goals` table, `revenue_goal` column | n/a | Per month, summed for quarter/year |
| `invoicedRevenueGoal` | Invoiced Revenue Goal ($) | From `revenue_goals` table, `invoiced_revenue_goal` column | n/a | Added in migration 009 |
| `projectsGoal` | Projects Goal (#) | From `revenue_goals` table, `projects_goal` column | n/a | Per month |
| `openQuotesTotal` | Open Quotes ($) | `SUM` Odoo draft/sent quotes (not expired) | Odoo | Requires Odoo connection |
| `odooAccountBalance` | Odoo Account Balance | Movement or balance from Odoo accounting | Odoo | Configurable per measurable (date_range vs last_day) |

### Key Corrections This Will Enforce

1. **Signage preview** stops using `updated_at` for invoiced revenue → uses `invoiced_date`
2. **Signage preview** stops using `created_at` for POs → uses `created_date`
3. **Signage preview + engine** stop using `ilike %invoiced%` pattern matching → uses explicit status ID lookup
4. **Signage preview + engine** stop querying nonexistent `amount` column on `revenue_goals` → uses `revenue_goal` column
5. **Signage engine** stops using `status_history` + `total_value` for invoiced revenue → uses `invoiced_date` + `sales_amount` on `projects` table directly
6. **Scorecard** weekly calculations use the same core filters, just scoped to week-range dates

### `revenue_goals` Table Schema (Verified)

```sql
-- Migration 006
revenue_goal    DECIMAL(12,2)  -- PO revenue goal (monthly)
projects_goal   INT            -- Project count goal (monthly)

-- Migration 009 (added later)
invoiced_revenue_goal  NUMERIC(12,2)  -- Invoiced revenue goal (monthly)
```

**BUG FOUND:** Both signage preview and signage engine query `revenue_goals.amount` — this column does not exist. The correct column is `revenue_goal`. These queries silently return 0 for all goals.

---

## Section 2: Library Structure

```
src/lib/metrics/
  types.ts         — Metric key enum, period types, result interfaces
  definitions.ts   — Canonical metric metadata (names, descriptions, units)
  queries.ts       — Supabase query builders for each metric
  compute.ts       — Pure computation functions (filter, sum, count, aggregate)
  periods.ts       — Date range helpers (month, quarter, YTD, last-12, week)
  index.ts         — Public API re-exports
```

### Shared Types

```typescript
// types.ts
export type MetricKey =
  | 'posReceivedRevenue'
  | 'posReceivedCount'
  | 'invoicedRevenue'
  | 'invoicedCount'
  | 'activeProjectCount'
  | 'pipelineRevenue'
  | 'avgDaysToInvoice'
  | 'revenueGoal'
  | 'invoicedRevenueGoal'
  | 'projectsGoal'
  | 'openQuotesTotal'
  | 'odooAccountBalance';

export type PeriodType = 'month' | 'quarter' | 'ytd' | 'last12' | 'week' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface MetricResult<T = number> {
  key: MetricKey;
  value: T;
  period: DateRange;
}
```

---

## Section 3: All Consumers — Current State & Required Changes

### Consumer 1: Dashboard Homepage (CANONICAL — minimal changes)

**Files:**
- `src/app/actions/dashboard.ts` — Server action, fetches raw data
- `src/components/dashboard/dashboard-content.tsx` — Client component, computes metrics

**Current behavior:** Computes all metrics client-side from raw project data. Uses `created_date` for POs, `invoiced_date` for invoiced, `revenue_goal` + `invoiced_revenue_goal` for goals.

**Changes needed:**
- Extract metric computation logic from `dashboard-content.tsx` into `src/lib/metrics/compute.ts`
- Dashboard component imports from `src/lib/metrics/` instead of inline `useMemo` calculations
- Keep raw data fetching in `dashboard.ts` (it fetches projects, statuses, goals — this is reusable)
- The client component continues to receive raw data and call compute functions (needed for period switching without server round-trips)

**Scope:** Medium — extract ~100 lines of `useMemo` logic into shared functions, update imports

---

### Consumer 2: L10 Scorecard Auto-Populate

**Files:**
- `src/app/(dashboard)/l10/scorecard-actions.ts` — `autoPopulateScorecardWeek()` function

**Current behavior:** For each measurable with `auto_source`, runs its own Supabase queries:
- `po_revenue` → queries `projects` with `created_date` in week range ✅ (already correct)
- `invoiced_revenue` → queries `projects` with `invoiced_date` in week range ✅ (already correct)
- `open_projects` → point-in-time snapshot: `created_date <= end AND (invoiced_date is null OR > end)` ⚠️ (intentionally different — weekly snapshot)
- `odoo_quotes` → calls Odoo API ✅
- `odoo_account` → calls Odoo API ✅

**Changes needed:**
- Replace `po_revenue` and `invoiced_revenue` query blocks with calls to shared metric functions
- `open_projects` stays as-is (point-in-time snapshot is intentionally different from dashboard's "currently active" count)
- Odoo metrics stay as-is (already correct, Odoo logic doesn't belong in shared metrics)

**Scope:** Small — replace 2 query blocks (~30 lines) with shared function calls

---

### Consumer 3: Signage Preview (Admin UI)

**Files:**
- `src/app/(dashboard)/admin/signage/preview/actions.ts` — `getPreviewData()` server action

**Current bugs (all fixed by this migration):**
1. Uses `updated_at` for invoiced this month (line 188) → should use `invoiced_date`
2. Uses `updated_at` for quarter revenue (line 209) → should use `invoiced_date`
3. Uses `created_at` for POs this month (line 141) → should use `created_date`
4. Uses `ilike %invoiced%` to find status (line 109) → should use explicit status name match
5. Uses `ilike %complete%` as separate status (line 109) → Completed = Invoiced, no separate status
6. Queries `revenue_goals.amount` (line 169) → column doesn't exist, should be `revenue_goal`
7. Active projects exclude `%complete%` pattern (line 79) → should exclude by specific status IDs (Invoiced, Cancelled)

**Changes needed:**
- Replace all inline queries with shared metric function calls
- Fix revenue_goals column name
- Fix date field usage
- Fix status filtering

**Scope:** Large — rewrite most of `getPreviewData()` to use shared metrics (~150 lines replaced)

---

### Consumer 4: Signage Engine (Separate Node.js Process)

**Files:**
- `signage-engine/src/data/fetchers/revenue.ts` — `fetchRevenueData()`
- `signage-engine/src/data/fetchers/projects.ts` — `fetchActiveProjects()`, `fetchInvoicedProjects()`
- `signage-engine/src/data/fetchers/pos.ts` — `fetchPOs()`

**Current bugs:**
1. `revenue.ts` uses `status_history` + `new_status_id` to find invoiced revenue → should use `invoiced_date` on `projects` table
2. `revenue.ts` uses `ilike %invoiced%` for status lookup (line 101) → should use exact name match
3. `revenue.ts` queries `revenue_goals.amount` (line 28) → column doesn't exist, should be `revenue_goal`
4. `revenue.ts` references `projects.total_value` (line 45) → column is actually `sales_amount`
5. `projects.ts:fetchInvoicedProjects()` uses `updated_at` for ordering/display (line 139) → should use `invoiced_date`
6. `projects.ts:fetchActiveProjects()` uses `ilike %complete%` pattern (line 42) → should use explicit status IDs
7. `pos.ts` uses `created_at` for PO date filtering (line 49) → should use `created_date`

**Architecture decision:** The signage engine is a separate Node.js process that can't directly import from the Next.js app's `src/lib/metrics/`. Two options:
- **Option A:** Create a shared `packages/metrics/` package at the monorepo root that both Next.js app and signage engine import
- **Option B:** Duplicate the query logic in signage engine, using the shared definitions as the reference spec (simpler but risks drift)

**Recommended: Option A** — extract to a shared package. The signage engine already uses Supabase client, so the query builders are compatible.

**Scope:** Large — rewrite 3 fetcher files (~250 lines), set up shared package import

---

### Consumer 5: iOS / PWA Mobile App

**Files:**
- `src/app/api/mobile/projects/route.ts` — `GET /api/mobile/projects`
- PWA (next-pwa) — runs the same Next.js pages in a webview/home screen app

**Current behavior:**
- The mobile projects API returns project list filtered by `phase` (sold, active, on_hold) — this is a different filter axis than status-based "active projects"
- The PWA renders the same dashboard pages as the web app, so it inherits whatever the dashboard computes

**Changes needed:**
- **PWA/web views:** No separate changes needed — these render the same React components that will be updated in Consumer 1
- **Mobile API (`/api/mobile/projects`):** This route filters by `phase`, not by status. It doesn't compute sales metrics. **No changes needed** unless we want to add a metrics endpoint for mobile.

**Future consideration:** If the iOS app ever needs a dedicated metrics summary (e.g., a widget or home screen), add a `GET /api/metrics` endpoint that uses the shared library. This is not currently needed.

**Scope:** None (inherits from Consumer 1 via shared PWA pages)

---

### Consumer 6: Signage Renderer Blocks (Display Layer)

**Files:**
- `signage-engine/src/renderer/blocks/quick-stats.ts`
- `signage-engine/src/renderer/blocks/projects-invoiced.ts`
- `signage-engine/src/renderer/blocks/po-highlight.ts`

**Current behavior:** These are rendering blocks that receive pre-computed data from the fetchers (Consumer 4). They don't compute metrics themselves.

**Changes needed:** None — these consume the output of the fetcher functions. Once the fetchers are fixed, the blocks automatically display correct data.

**Scope:** None (downstream of Consumer 4)

---

## Section 4: Implementation Plan

### Phase 1: Create Shared Metrics Library (no consumers changed yet)
1. Create `src/lib/metrics/types.ts` — metric keys, period types, interfaces
2. Create `src/lib/metrics/periods.ts` — date range builders (month, quarter, YTD, week, last-12)
3. Create `src/lib/metrics/queries.ts` — Supabase query builders for each metric
4. Create `src/lib/metrics/compute.ts` — pure computation functions
5. Create `src/lib/metrics/definitions.ts` — human-readable names, units, descriptions
6. Create `src/lib/metrics/index.ts` — public API
7. Write tests for all pure functions (periods, compute)

### Phase 2: Migrate Dashboard Homepage (canonical consumer)
1. Replace inline `useMemo` metric calculations in `dashboard-content.tsx` with shared library calls
2. Verify dashboard shows identical numbers before/after
3. Write integration test comparing old vs new calculation results

### Phase 3: Fix Signage Preview
1. Rewrite `getPreviewData()` to use shared metric functions
2. Fix all 7 bugs listed above
3. Verify preview page shows correct numbers

### Phase 4: Fix L10 Scorecard
1. Replace `po_revenue` and `invoiced_revenue` query blocks with shared calls
2. Keep `open_projects` point-in-time logic (intentionally different)
3. Verify scorecard auto-populate produces same results for correctly-dated projects

### Phase 5: Fix Signage Engine
1. Decide on shared package approach (recommended: `packages/metrics/` or copy query logic)
2. Rewrite `revenue.ts` — use `invoiced_date` on projects, fix column names
3. Rewrite `projects.ts` — fix status filtering, use `invoiced_date` for invoiced projects
4. Rewrite `pos.ts` — use `created_date` instead of `created_at`
5. Update signage engine tests

### Phase 6: Verification & Cleanup
1. Remove all dead code (old inline queries)
2. Run full test suite
3. Manual verification on staging: compare dashboard, signage preview, signage engine, and scorecard numbers side by side
4. Update CLAUDE.md with metrics library documentation

---

## Section 5: Divergence Matrix (Before vs After)

### Before (Current State)

| Metric | Dashboard | Signage Preview | Signage Engine | Scorecard |
|---|---|---|---|---|
| Invoiced date field | `invoiced_date` ✅ | `updated_at` ❌ | `status_history.changed_at` ❌ | `invoiced_date` ✅ |
| PO date field | `created_date` ✅ | `created_at` ❌ | `created_at` ❌ | `created_date` ✅ |
| Active project filter | `!= Invoiced` status | `ilike` excludes 3 patterns | `ilike` excludes 3 patterns | point-in-time (intentional) |
| Revenue goal column | `revenue_goal` ✅ | `amount` ❌ (doesn't exist) | `amount` ❌ (doesn't exist) | n/a |
| Invoiced revenue source | `projects.sales_amount` ✅ | `projects.sales_amount` ✅ | `projects.total_value` ❌ (wrong column) | `projects.sales_amount` ✅ |

### After (With Shared Library)

| Metric | Dashboard | Signage Preview | Signage Engine | Scorecard |
|---|---|---|---|---|
| Invoiced date field | `invoiced_date` ✅ | `invoiced_date` ✅ | `invoiced_date` ✅ | `invoiced_date` ✅ |
| PO date field | `created_date` ✅ | `created_date` ✅ | `created_date` ✅ | `created_date` ✅ |
| Active project filter | Invoiced + Cancelled ✅ | Invoiced + Cancelled ✅ | Invoiced + Cancelled ✅ | point-in-time ✅ (intentional) |
| Revenue goal column | `revenue_goal` ✅ | `revenue_goal` ✅ | `revenue_goal` ✅ | n/a |
| Invoiced revenue source | `projects.sales_amount` ✅ | `projects.sales_amount` ✅ | `projects.sales_amount` ✅ | `projects.sales_amount` ✅ |

---

## Section 6: Common Variables Quick Reference

These are the canonical variable names to use everywhere in the codebase:

```typescript
// === DATE FIELDS (on projects table) ===
// PO received date (user-editable):     created_date     (NOT created_at)
// Invoice date:                          invoiced_date    (NOT updated_at, NOT status_history)

// === MONEY FIELD ===
// Project value:                         sales_amount     (NOT total_value)

// === REVENUE GOALS (revenue_goals table) ===
// PO revenue goal:                       revenue_goal          (NOT amount)
// Invoiced revenue goal:                 invoiced_revenue_goal
// Project count goal:                    projects_goal

// === STATUS FILTERING ===
// "Active" means:  current_status NOT IN (Invoiced, Cancelled)
// "Invoiced" means: status.name === 'Invoiced'  (NOT ilike '%invoiced%')
// There is NO separate "Completed" status — Completed = Invoiced

// === METRIC KEYS (use these names in code) ===
// posReceivedRevenue    — SUM(sales_amount) WHERE created_date in period
// posReceivedCount      — COUNT(*) WHERE created_date in period
// invoicedRevenue       — SUM(sales_amount) WHERE invoiced_date in period
// invoicedCount         — COUNT(*) WHERE invoiced_date in period
// activeProjectCount    — COUNT(*) WHERE status NOT IN (Invoiced, Cancelled)
// pipelineRevenue       — SUM(sales_amount) of active projects
// avgDaysToInvoice      — AVG(invoiced_date - created_date)
// revenueGoal           — From revenue_goals.revenue_goal
// invoicedRevenueGoal   — From revenue_goals.invoiced_revenue_goal
```
