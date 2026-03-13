# Deals UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Upcoming Deals page with a goal thermometer hero card, pipeline outlook summary, and collapsible month-grouped deal sections.

**Architecture:** Refactor `UpcomingDealsContent` into 3 sub-components: `MonthHeroCard`, `PipelineOutlook`, and `DealMonthSection`. Extend the existing deals API to return PO-confirmed status by matching AC account IDs to projects with PO numbers. Fetch revenue goals client-side from Supabase.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui (Card, Collapsible, Progress), Supabase client, existing AC deals API.

---

### Task 1: Extend Deals API to Include PO Status

**Files:**
- Modify: `src/app/api/activecampaign/deals/route.ts`
- Modify: `src/types/activecampaign.ts`

**Step 1: Add `hasConfirmedPO` to type**

In `src/types/activecampaign.ts`, add to `ACDealDisplay`:

```typescript
// Add to ACDealDisplay interface
hasConfirmedPO: boolean;
```

**Step 2: Query projects with PO numbers in the API route**

In `src/app/api/activecampaign/deals/route.ts`, after resolving deals, query Supabase for projects that have both an `activecampaign_account_id` and a non-null `po_number`:

```typescript
// After resolving deals, before sorting
// Fetch projects with PO numbers to match against deals
const { data: projectsWithPO } = await supabase
  .from('projects')
  .select('activecampaign_account_id')
  .not('activecampaign_account_id', 'is', null)
  .not('po_number', 'is', null);

const poAccountIds = new Set(
  (projectsWithPO || []).map((p: { activecampaign_account_id: string | null }) => p.activecampaign_account_id)
);
```

Then in the deal mapping, set:

```typescript
hasConfirmedPO: deal.account ? poAccountIds.has(deal.account) : false,
```

**Step 3: Run the app and verify the API returns `hasConfirmedPO`**

Run: `curl -s localhost:3000/api/activecampaign/deals | jq '.deals[0].hasConfirmedPO'`

**Step 4: Commit**

```
feat: add PO confirmation status to deals API response
```

---

### Task 2: Create MonthHeroCard Component

**Files:**
- Create: `src/components/deals/month-hero-card.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MonthHeroCardProps {
  monthLabel: string; // e.g. "March 2026"
  goal: number; // dollars
  confirmedPOValue: number;
  confirmedPOCount: number;
  verbalCommitValue: number;
  verbalCommitCount: number;
}

export function MonthHeroCard({
  monthLabel,
  goal,
  confirmedPOValue,
  confirmedPOCount,
  verbalCommitValue,
  verbalCommitCount,
}: MonthHeroCardProps) {
  const totalValue = confirmedPOValue + verbalCommitValue;
  const percentage = goal > 0 ? Math.round((totalValue / goal) * 100) : 0;
  const gap = totalValue - goal;

  // Color: green >= 100%, amber 70-99%, red < 70%
  const barColor =
    percentage >= 100
      ? 'bg-green-500'
      : percentage >= 70
        ? 'bg-amber-500'
        : 'bg-red-500';

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  const GapIcon = gap >= 0 ? TrendingUp : gap === 0 ? Minus : TrendingDown;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1.5 text-sm">
            <GapIcon className="h-3.5 w-3.5" />
            <span className={gap >= 0 ? 'text-green-600' : 'text-red-600'}>
              {gap >= 0 ? '+' : ''}{formatValue(Math.abs(gap))} {gap >= 0 ? 'over' : 'short'}
            </span>
          </div>
        </div>

        {/* Main progress */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-2xl font-bold">{formatValue(totalValue)}</span>
              <span className="text-muted-foreground"> of {formatValue(goal)} goal</span>
            </span>
            <span className="text-muted-foreground">{percentage}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Confirmed POs</p>
            <p className="text-lg font-semibold">{formatValue(confirmedPOValue)}</p>
            <p className="text-xs text-muted-foreground">{confirmedPOCount} deal{confirmedPOCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Verbal Commits</p>
            <p className="text-lg font-semibold">{formatValue(verbalCommitValue)}</p>
            <p className="text-xs text-muted-foreground">{verbalCommitCount} deal{verbalCommitCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```
feat: add MonthHeroCard component for deal goal tracking
```

---

### Task 3: Create PipelineOutlook Component

**Files:**
- Create: `src/components/deals/pipeline-outlook.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MonthSummary {
  key: string; // YYYY-MM
  label: string; // "March 2026"
  dealCount: number;
  value: number; // dollars
  goal: number | null; // null if no goal set
}

interface PipelineOutlookProps {
  months: MonthSummary[];
  unscheduled: { dealCount: number; value: number } | null;
  totalDeals: number;
  totalValue: number;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
  onMonthClick: (monthKey: string) => void;
}

export function PipelineOutlook({
  months,
  unscheduled,
  totalDeals,
  totalValue,
  allExpanded,
  onToggleExpandAll,
  onMonthClick,
}: PipelineOutlookProps) {
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pipeline Outlook
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpandAll}
            className="gap-1 text-xs"
          >
            {allExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>

        <div className="divide-y">
          {months.map((month) => {
            const pct = month.goal ? Math.round((month.value / month.goal) * 100) : null;
            return (
              <button
                key={month.key}
                onClick={() => onMonthClick(month.key)}
                className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-sm font-medium w-24 shrink-0">{month.label.split(' ')[0]}</span>
                <span className="text-xs text-muted-foreground w-16 shrink-0">
                  {month.dealCount} deal{month.dealCount !== 1 ? 's' : ''}
                </span>
                <span className="text-sm w-36 shrink-0">
                  {formatValue(month.value)}
                  {month.goal ? (
                    <span className="text-muted-foreground"> / {formatValue(month.goal)}</span>
                  ) : null}
                </span>
                {pct !== null ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground flex-1">—</span>
                )}
              </button>
            );
          })}

          {unscheduled && (
            <button
              onClick={() => onMonthClick('unscheduled')}
              className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm font-medium w-24 shrink-0 italic text-muted-foreground">Unsched.</span>
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                {unscheduled.dealCount} deal{unscheduled.dealCount !== 1 ? 's' : ''}
              </span>
              <span className="text-sm">{formatValue(unscheduled.value)}</span>
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground">—</span>
            </button>
          )}

          {/* Total row */}
          <div className="px-4 py-2.5 flex items-center gap-4 bg-muted/30">
            <span className="text-sm font-semibold w-24 shrink-0">Total</span>
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              {totalDeals} deal{totalDeals !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-semibold">{formatValue(totalValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```
feat: add PipelineOutlook component with per-month goal bars
```

---

### Task 4: Create DealMonthSection Component

**Files:**
- Create: `src/components/deals/deal-month-section.tsx`

**Step 1: Create the component**

Uses shadcn `Collapsible` for expand/collapse.

```tsx
'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

interface DealMonthSectionProps {
  label: string; // "March 2026" or "Unscheduled"
  deals: ACDealDisplay[];
  totalValue: number;
  isOpen: boolean;
  onToggle: () => void;
}

export function DealMonthSection({ label, deals, totalValue, isOpen, onToggle }: DealMonthSectionProps) {
  const formatValue = (cents: string) => {
    const dollars = parseInt(cents, 10) / 100;
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
    return `$${dollars.toLocaleString()}`;
  };

  const formatTotal = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-2">
              <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <span className="font-medium">{label}</span>
              <span className="text-sm text-muted-foreground">
                {deals.length} deal{deals.length !== 1 ? 's' : ''} &middot; {formatTotal(totalValue)}
              </span>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-t border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium text-right">Value</th>
                  <th className="px-4 py-2 font-medium text-right">Close Date</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <a
                        href={deal.dealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        {deal.title}
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-sm">{deal.accountName || '\u2014'}</td>
                    <td className="px-4 py-2.5 text-sm text-right">{formatValue(deal.value)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">
                      {deal.forecastCloseDate
                        ? format(parseISO(deal.forecastCloseDate), 'MMM d')
                        : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
```

**Step 2: Commit**

```
feat: add DealMonthSection collapsible component
```

---

### Task 5: Rewrite UpcomingDealsContent to Compose New Components

**Files:**
- Modify: `src/components/deals/upcoming-deals-content.tsx`

**Step 1: Rewrite the component**

Replace the entire file. The new version:
1. Fetches deals from AC API (existing)
2. Fetches current year's revenue goals from Supabase
3. Groups deals by month
4. Computes hero card stats for current month
5. Renders: `MonthHeroCard` → `PipelineOutlook` → `DealMonthSection` per month

Key logic:
- Group deals by `forecastCloseDate.slice(0, 7)` (YYYY-MM), with fallback group `unscheduled`
- Current month = `format(new Date(), 'yyyy-MM')`
- Auto-expand current month, collapse others
- `allExpanded` state toggles all sections
- `onMonthClick` in PipelineOutlook expands that section and scrolls to it via `ref`
- Revenue goals fetched via Supabase client: `supabase.from('revenue_goals').select('*').eq('year', currentYear)`
- Hero card shows current month only. If no goal for current month, hide the goal/gap and just show totals.
- PO vs. verbal split uses `deal.hasConfirmedPO` from the updated API

**Step 2: Verify the page renders at `localhost:3000/upcoming-deals`**

**Step 3: Commit**

```
feat: rewrite upcoming deals page with goal thermometer layout
```

---

### Task 6: Visual Polish and Edge Cases

**Files:**
- Modify: `src/components/deals/upcoming-deals-content.tsx`
- Modify: `src/components/deals/month-hero-card.tsx`

**Step 1: Handle edge cases**

- No deals: show empty state message
- No goal for current month: hide gap indicator, show just the total
- AC not configured: show existing amber warning
- Loading state: skeleton cards instead of plain text

**Step 2: Verify all edge cases**

- Test with no deals
- Test with deals but no revenue goal set for current month

**Step 3: Commit**

```
fix: handle edge cases in deals UI (no goals, no deals, loading)
```

---

### Task 7: Remove Old Code

**Files:**
- Modify: `src/components/deals/upcoming-deals-content.tsx`

**Step 1: Verify no old code remains**

Ensure the old summary table, date range filters, contact column, and per-column sort buttons are fully removed (they should be gone from the Task 5 rewrite, but double-check).

**Step 2: Final commit**

```
chore: clean up removed deals UI code
```
