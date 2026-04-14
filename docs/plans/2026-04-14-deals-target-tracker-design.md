# Deals Target Tracker — Design Document

**Date:** 2026-04-14
**Branch:** `upcoming-deals-target`
**Approach:** Enhance existing Upcoming Deals page in-place

## Problem

The Upcoming Deals page shows pipeline deals but doesn't clearly answer: "How close are we to our monthly/quarterly PO goal?" Sales leaders need to see received POs vs verbal commits vs target in one glance, with actionable signals for deals that need attention.

## Data Sources

| Metric | Source | Query |
|--------|--------|-------|
| POs Received | `projects` table | `SUM(sales_amount) WHERE po_number IS NOT NULL AND created_date IN month` |
| Verbal Commits | ActiveCampaign API | Deals in Solutions Pipeline, Verbal Commit stage, with `forecastCloseDate` in month |
| Monthly Goals | `revenue_goals` table | `revenue_goal` for year/month |
| Quarterly Goals | `revenue_goals` table | `SUM(revenue_goal)` for 3 months in quarter |
| Slipped Deals | ActiveCampaign API | Verbal Commit deals where `forecastCloseDate < today - 14 days` |
| Win Rate | `projects` table + AC | Projects with PO in month / total AC deals that had forecast close in month |
| Earlier-Stage Deals | ActiveCampaign API | Deals in pre-Verbal-Commit stages with `forecastCloseDate` in current month |

## Feature Scope

### 1. Enhanced Hero Card (replaces `MonthHeroCard`)

**Stacked progress bar** with three segments:
- Green (solid): POs Received — from projects table
- Amber (lighter): Verbal Commits — from AC deals
- Gray (muted): Gap to Goal — remaining amount

**Three stat cards** below the bar:
- POs Received: dollar value + count
- Verbal Commits: dollar value + deal count
- Gap to Goal: dollar amount + percentage

**Monthly/Quarterly toggle** — button group at page top:
- Monthly (default): shows current month
- Quarterly: aggregates into Q1-Q4, shows current quarter

### 2. Slipped Deals Callout

Displayed between hero card and Pipeline Outlook when slipped deals exist.

A deal is "slipped" when:
- In Verbal Commit stage
- `forecastCloseDate` is more than 14 days before today

Shows: deal title (linked to AC), account name, original close date, days overdue, value. Sorted by days overdue descending. Capped at 10 with "View all" if more.

### 3. Win Rate in Pipeline Outlook

Add a "Win %" column to each month row in Pipeline Outlook:
- Numerator: count of projects with `po_number IS NOT NULL` and `created_date` in that month
- Denominator: total AC deals that had `forecastCloseDate` in that month (requires fetching deal history or approximating from current data)
- Display: percentage, e.g. "67%"
- Only show for past and current months (future months have no win data)

**Approximation note:** We may not have historical AC deal data for past months. For v1, compute from projects table only: projects with PO / (projects with PO + current verbal commits for that month). This understates the denominator but is directionally useful.

### 4. Earlier-Stage Deals Callout

Small card below the hero showing deals in earlier AC pipeline stages (before Verbal Commit) that have a forecast close date in the current month.

Shows: count and total value, e.g. "3 deals ($120K) still in earlier stages — need to advance to Verbal Commit"

Clicking expands to show deal list (title, stage, account, value, close date).

**Implementation note:** Requires an additional AC API call to fetch deals from stages before Verbal Commit with forecast close dates. Need to identify the relevant stage IDs.

### 5. Quarterly View

Toggle between Monthly and Quarterly at the top of the page.

**Hero card in quarterly mode:**
- Shows current quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
- Aggregates POs, verbal commits, and goals across the 3 months
- Same stacked bar visualization

**Pipeline Outlook in quarterly mode:**
- Groups months under quarter headers (Q2 2026, Q3 2026, etc.)
- Quarter row shows aggregated deal count, value, goal, progress bar
- Months nested below each quarter row (indented, smaller text)
- Deals sections below still grouped by month (not collapsed into quarters)

## Components Modified

| Component | Change |
|-----------|--------|
| `upcoming-deals-content.tsx` | Add quarterly toggle state, fetch projects data for POs, compute win rates |
| `month-hero-card.tsx` | Rename to `target-tracker-card.tsx`, add stacked bar, three stat cards, support quarter mode |
| `pipeline-outlook.tsx` | Add win rate column, quarterly grouping mode |
| New: `slipped-deals-callout.tsx` | Slipped deals warning section |
| New: `earlier-stage-callout.tsx` | Earlier-stage deals callout |
| New: `view-toggle.tsx` | Monthly/Quarterly toggle button group |

## API Changes

| Endpoint | Change |
|----------|--------|
| `GET /api/activecampaign/deals` | Add query param `?stages=all` to optionally return deals from all stages (not just Verbal Commit) |
| New server action | `getReceivedPOs(month: string)` — query projects table for POs received in a month |
| New server action | `getReceivedPOsRange(startMonth: string, endMonth: string)` — query for quarterly aggregation |

## No Database Migrations Needed

All required data already exists in:
- `projects` table (po_number, sales_amount, created_date)
- `revenue_goals` table (year, month, revenue_goal)

## Wireframe — Monthly View

```
┌──────────────────────────────────────────────────────────────┐
│  Upcoming Deals                     Solutions Pipeline · VC   │
│                                     [Monthly ▾] [Quarterly]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─── APRIL 2026 ── Target Tracker ────────────────────────┐ │
│  │  $340K  of  $500K goal                             68%   │ │
│  │  ┌───────────────────────────────────────────────────┐   │ │
│  │  │████████████▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░│   │ │
│  │  │  POs $180K │ Verbal $160K │      Gap $160K       │   │ │
│  │  └───────────────────────────────────────────────────┘   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │ │
│  │  │  $180K   │  │  $160K   │  │  -$160K  │               │ │
│  │  │ 4 POs    │  │ 6 deals  │  │  32% gap │               │ │
│  │  │ Received │  │ Verbal   │  │ To Goal  │               │ │
│  │  └──────────┘  └──────────┘  └──────────┘               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ ! Slipped Deals (2 deals, $95K) ───────────────────────┐ │
│  │  Project X  │ Acme Co  │ Mar 28  │ 17 days late │ $55K  │ │
│  │  Install Y  │ Beta Inc │ Mar 30  │ 15 days late │ $40K  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Earlier Stages: 3 deals ($120K) need to reach VC ──────┐ │
│  │  ▸ Click to view details                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─── Pipeline Outlook ───────────────── [Expand All] ─────┐ │
│  │  April   8 deals  $340K/$500K  ████▓▓▓░░░ 68%   Win 67% │ │
│  │  May     5 deals  $220K/$450K  ███▓▓░░░░░ 49%   —       │ │
│  │  June    3 deals  $150K/$400K  ██▓░░░░░░░ 38%   —       │ │
│  │  Unsch.  4 deals  $190K        ————                      │ │
│  │  ─────────────────────────────────────────────           │ │
│  │  Total  22 deals  $980K                                  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Wireframe — Quarterly View

```
┌──────────────────────────────────────────────────────────────┐
│  Upcoming Deals                     Solutions Pipeline · VC   │
│                                     [Monthly] [Quarterly ▾]   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─── Q2 2026 ── Target Tracker ───────────────────────────┐ │
│  │  $710K  of  $1.35M goal                            53%   │ │
│  │  ┌───────────────────────────────────────────────────┐   │ │
│  │  │█████████▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │ │
│  │  │ POs $310K │ Verbal $400K │      Gap $640K        │   │ │
│  │  └───────────────────────────────────────────────────┘   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │ │
│  │  │  $310K   │  │  $400K   │  │  -$640K  │               │ │
│  │  │ 9 POs    │  │ 14 deals │  │  47% gap │               │ │
│  │  │ Received │  │ Verbal   │  │ To Goal  │               │ │
│  │  └──────────┘  └──────────┘  └──────────┘               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─── Quarterly Outlook ────────────────────────────────────┐ │
│  │  Q2 2026  16 deals  $710K/$1.35M  █████▓▓▓░░ 53%        │ │
│  │    Apr     8 deals  $340K/$500K                    67%   │ │
│  │    May     5 deals  $220K/$450K                    —     │ │
│  │    Jun     3 deals  $150K/$400K                    —     │ │
│  │  Q3 2026   2 deals   $80K/$1.05M  █░░░░░░░░░  8%        │ │
│  │    Jul     2 deals   $80K/$350K                    —     │ │
│  │  ─────────────────────────────────────────────           │ │
│  │  Total    22 deals  $980K                                │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```
