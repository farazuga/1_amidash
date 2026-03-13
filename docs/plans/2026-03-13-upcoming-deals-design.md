# Upcoming Deals Page - Design

## Overview

New dashboard page at `/upcoming-deals` that pulls deals from ActiveCampaign's "Solution" pipeline, filtered to only the "Verbal Commit" stage, sorted by expected close date. Includes a date range filter.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/types/activecampaign.ts` | Modify | Add `ACDeal`, `ACDealStage`, `ACPipeline` types |
| `src/lib/activecampaign.ts` | Modify | Add `getPipelines()`, `getDealStages()`, `getDeals()` methods |
| `src/app/api/activecampaign/deals/route.ts` | Create | API route - fetches Verbal Commit deals from Solution pipeline |
| `src/app/(dashboard)/upcoming-deals/page.tsx` | Create | Server component page |
| `src/components/deals/upcoming-deals-content.tsx` | Create | Client component - table with date filter |
| `src/components/layout/sidebar.tsx` | Modify | Add "Upcoming Deals" nav item |

## Types

```typescript
interface ACDeal {
  id: string;
  title: string;
  value: string;        // cents as string
  currency: string;
  contact: string;       // contact ID
  account: string;       // account ID
  stage: string;         // stage ID
  group: string;         // pipeline ID
  owner: string;         // owner user ID
  status: string;        // "0"=open, "1"=won, "2"=lost
  cdate: string;         // created date ISO
  mdate: string;         // modified date ISO
  nextdate?: string;     // next task date
  // We'll also attach resolved names:
  contactName?: string;
  accountName?: string;
}

interface ACDealStage {
  id: string;
  title: string;
  group: string;         // pipeline ID
  order: string;
}

interface ACPipeline {
  id: string;
  title: string;
}
```

## Data Flow

1. `GET /api/activecampaign/deals` is called
2. API route calls AC: `getPipelines()` -> finds "Solution" pipeline by title
3. API route calls AC: `getDealStages(pipelineId)` -> finds "Verbal Commit" stage by title
4. API route calls AC: `getDeals({ stageId, status: 0 })` -> open deals in that stage
5. For each deal, resolve contact name and account name from AC
6. Return deals sorted by created date (ascending)

## UI

- Page header: "Upcoming Deals"
- Summary stat: total pipeline value of visible deals
- Date range filter (date picker for start/end date, filters by deal created date)
- Table columns: Title | Value | Account | Contact | Close Date
- Value formatted as currency ($50K, $120K, etc.)
- Sorted by date ascending (soonest first)
- Empty state when no deals match

## Notes

- No database tables needed - live read from ActiveCampaign API
- Follows existing AC client singleton pattern
- API route includes auth check (consistent with other AC routes)
- Pipeline/stage names matched case-insensitively for robustness
