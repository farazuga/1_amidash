# Deals UI Redesign — "Goal Thermometer" Design

**Date:** 2026-03-13
**Status:** Approved

## Overview

Redesign the Upcoming Deals page to prioritize monthly goal tracking, replace the flat deals table with collapsible month-grouped sections, and add a hero card showing this-month progress at a glance.

## Layout (top to bottom)

### 1. Header

- Title: "Upcoming Deals"
- Subtitle: "Solutions Pipeline · Verbal Commit"

### 2. This Month Hero Card

Shows current month's progress against the revenue goal from `revenue_goals` table.

- **Progress bar**: `$185K of $200K goal — 92%`
  - Green >= 100%, amber 70-99%, red < 70%
- **Breakdown rows**:
  - Confirmed POs: deals where linked project has a `po_number` set
  - Verbal Commits: remaining deals (default AC state)
- Goal pulled via `revenue_goals` table (year, month)

### 3. Pipeline Outlook

Compact summary table replacing the old monthly/quarterly table.

- One row per month with: deal count, value, goal comparison, inline mini bar, percentage
- "Expand All / Collapse All" toggle button in the header
- Clicking a month row scrolls to / expands that month's deal section
- Unscheduled row for deals without forecast close date (no bar)
- Total row at bottom (no bar)
- If no goal set for a month, show value only (no bar/percentage)

### 4. Deal Sections by Month

Collapsible card per month. Current month auto-expanded, others collapsed.

- Header: `March 2026 (5 deals · $185K)` with expand/collapse chevron
- Table columns: Title (linked to AC ↗), Account, Value, Close Date
- Sorted by close date within each month
- Unscheduled section at the bottom

## What's Removed

- Date range filter pickers (month grouping replaces this)
- Contact column
- Per-column sort buttons (month grouping handles ordering)

## What's New

- Hero card with goal progress bar + PO vs. verbal breakdown
- Pipeline outlook with per-month goal bars
- Expand All / Collapse All toggle
- Collapsible month sections

## Data Sources

- **Deals**: existing `GET /api/activecampaign/deals` endpoint (no changes needed)
- **Goals**: `revenue_goals` table via Supabase (`year`, `month`, `revenue_goal`)
- **PO detection**: match deal `accountName` to project with `po_number` set (best-effort match)

## Components

- `UpcomingDealsContent` — refactor existing component
- `MonthHeroCard` — new, this-month goal progress
- `PipelineOutlook` — new, compact month summary with bars
- `DealMonthSection` — new, collapsible month group with deals table
