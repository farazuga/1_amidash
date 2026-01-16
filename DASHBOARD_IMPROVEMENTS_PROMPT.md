# AmiDash Dashboard & Digital Signage Improvements

## Context

AmiDash is a project management dashboard for a professional services firm. The workflow tracks projects from **PO Received** through **Invoiced**. Key metrics are **monthly POs received** and **monthly revenue invoiced**.

The system has two display surfaces:
1. **Web Dashboard** - Full interactive dashboard for desktop users
2. **Digital Signage** - NDI video output to office TVs for quick employee engagement

## Current State

### Web Dashboard (Already Exists)
- Revenue tracking: POs received vs invoiced (month/quarter/YTD/rolling 12)
- 8 mini metrics: Done, Active, Pipeline, DTI, Backlog, On-Time %, Stuck, Customer Concentration
- Health diagnostics with bottleneck detection
- Charts: velocity, status distribution, cycle time, revenue forecast
- Alerts: Overdue projects, WIP aging, customer concentration risk

### Digital Signage Engine (Already Exists)
- NDI video output at 4K/30fps
- 5 slide types: Active Projects, Project Metrics, PO Ticker, Revenue Dashboard, Team Schedule
- Admin interface at `/admin/signage`
- Auto-refresh data polling (15-60 seconds)

### Project Workflow (8 Statuses)
1. PO Received
2. Engineering Review (bottleneck - internal subtasks)
3. In Procurement (bottleneck - backorders, external factors)
4. Pending Scheduling
5. Scheduled
6. IP (In Progress - when work actually starts)
7. Hold (exception status - bottleneck)
8. Invoiced (workflow ends here)

### Key Business Rules
- Partial invoicing exists, but full amount allocated when project completes
- Invoice date = date status changed to "Invoiced"
- Goal date is always manually set (auto-calculation not useful)
- POs entered within 24 hours of receipt
- "Stuck" metric serves as the nudge for status updates
- Project types: Box Sale (smaller), Solution (larger) - prioritize showing Solutions

---

## Requirements

### PHASE 1: Web Dashboard Improvements

#### 1.1 New Alert: Low Invoice Month Warning
**File:** `src/components/dashboard/dashboard-content.tsx` (or new component)

- Add alert card when current month's invoiced revenue is tracking below goal
- Calculate projected month-end based on current pace
- Show warning if projected < 80% of monthly invoice goal
- Display: "Invoice Alert: On pace for $X of $Y goal (Z%)"
- Color: Amber warning, Red if < 60%

#### 1.2 New Alert: Projects Not Scheduled
**File:** `src/components/dashboard/dashboard-content.tsx` (or new component)

- Show projects that have been in "PO Received", "Engineering Review", "In Procurement", or "Pending Scheduling" for more than X days without being scheduled
- Default threshold: 14 days (configurable in admin settings)
- Display: List of project names with days waiting
- Link to project detail page

#### 1.3 Enhanced Bottleneck Visibility
**File:** `src/components/dashboard/dashboard-content.tsx`

- Add dedicated "Bottleneck Summary" card
- Show count and total value of projects in:
  - Engineering Review (with average days in status)
  - In Procurement (with average days in status)
  - Hold (with average days in status)
- Click to expand and see project list for each bottleneck

#### 1.4 Project Hours Display (Individual Project Page)
**File:** `src/app/(dashboard)/projects/[salesOrder]/page.tsx`

- Calculate total scheduled hours from `assignment_days` table
- Display: "Total Scheduled Hours: X hours across Y days"
- Show breakdown by engineer if multiple assigned
- Formula: sum of (end_time - start_time) for all assignment_days

#### 1.5 Monthly Summary Enhancement
**File:** `src/components/dashboard/dashboard-content.tsx`

- Make "Monthly POs Received" and "Monthly Invoiced" the most prominent metrics
- These should be the first things visible, largest font size
- Show both absolute value and % of goal
- Add trend arrow comparing to same month last year (if data exists)

---

### PHASE 2: Digital Signage New Slides

#### 2.1 New Slide: "Coming Up Next 30 Days"
**File:** `signage-engine/src/slides/upcoming-projects.ts`

- Show projects with `start_date` in next 30 days
- Filter: Only show Solutions and large projects (sales_amount > threshold, configurable)
- Sort by start_date ascending
- Display per project:
  - Client name
  - Project type
  - Start date
  - Assigned engineers (if any)
  - Sales amount
- Layout: List format, max 6-8 projects for readability
- Skip Box Sales under $X threshold (configurable, default $10,000)

#### 2.2 New Slide: "Currently In Progress"
**File:** `signage-engine/src/slides/in-progress-projects.ts`

- Show projects with status = "IP" (In Progress) or "Scheduled" with start_date <= today
- Filter: Prioritize Solutions over Box Sales
- Display per project:
  - Client name
  - Engineer(s) assigned
  - Days in progress
  - Expected completion (goal_completion_date)
- Layout: Card grid (2x3 or 2x2 for larger text)

#### 2.3 New Slide: "Monthly Scorecard"
**File:** `signage-engine/src/slides/monthly-scorecard.ts`

- Large, prominent display of the two key metrics:
  - **POs Received This Month**: $X of $Y goal (Z%)
  - **Invoiced This Month**: $X of $Y goal (Z%)
- Visual progress bars or circular gauges
- Color coding: Green (>80%), Amber (60-80%), Red (<60%)
- Show days remaining in month
- This should be the "hero" slide - biggest numbers, most impactful

#### 2.4 New Slide: "Bottleneck Alert"
**File:** `signage-engine/src/slides/bottleneck-alert.ts`

- Only show if there ARE bottlenecks (skip slide if all clear)
- Display count and value of projects stuck in:
  - Engineering Review
  - In Procurement
  - Hold
- Show oldest project in each category
- Color: Amber/Red based on severity
- Purpose: Create awareness and urgency

#### 2.5 New Slide: "Recent Wins"
**File:** `signage-engine/src/slides/recent-wins.ts`

- Celebrate recently invoiced projects (last 7 days)
- Show: Client name, project value, salesperson
- Positive/celebratory design (green accents)
- Builds morale and shows progress
- Skip if no recent invoices

#### 2.6 Update Slide Configuration
**Files:**
- `signage-engine/src/types/index.ts` - Add new slide types to enum
- `signage-engine/src/slides/index.ts` - Register new slides
- `supabase/migrations/xxx_new_signage_slides.sql` - Add default slide configs
- `src/app/(dashboard)/admin/signage/slide-editor.tsx` - Add config options for new slides

New slide types to add to enum:
- `upcoming_projects`
- `in_progress`
- `monthly_scorecard`
- `bottleneck_alert`
- `recent_wins`

---

### PHASE 3: Admin Configuration

#### 3.1 New Dashboard Threshold Settings
**File:** `src/app/(dashboard)/admin/settings/page.tsx`

Add configurable thresholds:
- `not_scheduled_warning_days`: Days before "not scheduled" warning (default: 14)
- `low_invoice_warning_percent`: % of goal to trigger low invoice warning (default: 80)
- `signage_min_project_value`: Minimum project value to show on signage (default: 10000)
- `signage_upcoming_days`: Days to look ahead for "upcoming" slide (default: 30)

#### 3.2 Slide-Specific Configuration
**File:** `src/app/(dashboard)/admin/signage/slide-editor.tsx`

For new slides, add configuration options:
- **Upcoming Projects**: Days ahead (default 30), minimum value filter
- **In Progress**: Maximum items to show
- **Monthly Scorecard**: Show/hide individual metrics
- **Bottleneck Alert**: Thresholds for amber/red coloring
- **Recent Wins**: Days to look back (default 7)

---

## Technical Notes

### Database Queries Needed

1. **Projects not scheduled query:**
```sql
SELECT * FROM projects
WHERE current_status_id IN (status_ids for PO Received, Eng Review, Procurement, Pending Scheduling)
AND created_date < NOW() - INTERVAL 'X days'
AND (start_date IS NULL OR start_date > NOW() + INTERVAL '30 days')
```

2. **Monthly invoice projection:**
```sql
-- Get invoiced amount so far this month from status_history
SELECT SUM(p.sales_amount)
FROM projects p
JOIN status_history sh ON p.id = sh.project_id
WHERE sh.status_id = (SELECT id FROM statuses WHERE name = 'Invoiced')
AND sh.changed_at >= date_trunc('month', NOW())
```

3. **Upcoming projects (next 30 days):**
```sql
SELECT * FROM projects
WHERE start_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
AND sales_amount >= :min_value
ORDER BY start_date ASC
```

4. **Project hours calculation:**
```sql
SELECT
  pa.project_id,
  SUM(EXTRACT(EPOCH FROM (ad.end_time - ad.start_time))/3600) as total_hours
FROM assignment_days ad
JOIN project_assignments pa ON ad.assignment_id = pa.id
WHERE pa.project_id = :project_id
GROUP BY pa.project_id
```

### File Structure for New Slides

Each new slide should follow the existing pattern:
```
signage-engine/src/slides/
├── upcoming-projects.ts
├── in-progress-projects.ts
├── monthly-scorecard.ts
├── bottleneck-alert.ts
└── recent-wins.ts
```

Each slide file exports:
- `render(ctx, config, data)` function
- Uses canvas drawing API
- Follows existing color scheme (dark green #053B2C, accent #C2E0AD)
- Font: Karla/Inter, minimum 24pt for TV readability

### Signage Design Guidelines

- **Font sizes:** Minimum 32pt for body text, 48pt+ for headers, 72pt+ for key numbers
- **Colors:** Dark background (#053B2C), light text (#FFFFFF or #C2E0AD)
- **Layout:** Maximum 6-8 items per slide for readability from distance
- **Prioritization:** Solutions and large projects over Box Sales
- **Data freshness:** Show "Updated X minutes ago" indicator

---

## Completion Goals

Complete each phase sequentially. After each phase, verify:

### Phase 1 Complete When:
- [ ] Low invoice month warning appears on dashboard when projected < 80% of goal
- [ ] "Projects not scheduled" alert shows projects waiting > 14 days
- [ ] Bottleneck summary card shows Engineering/Procurement/Hold counts
- [ ] Individual project page shows total scheduled hours
- [ ] Monthly POs and Invoiced are the most prominent dashboard metrics
- [ ] All new components have proper TypeScript types
- [ ] No build errors (`npm run build` passes)

### Phase 2 Complete When:
- [ ] "Upcoming Projects (30 Days)" slide renders correctly
- [ ] "Currently In Progress" slide renders correctly
- [ ] "Monthly Scorecard" slide shows POs and Invoiced prominently
- [ ] "Bottleneck Alert" slide shows (or skips if no bottlenecks)
- [ ] "Recent Wins" slide celebrates invoiced projects
- [ ] All slides registered in slide manager
- [ ] Slide types added to database enum
- [ ] Default slide configurations added via migration
- [ ] Signage admin can enable/configure new slides

### Phase 3 Complete When:
- [ ] Admin settings page has new threshold configurations
- [ ] Slide editor has configuration options for all new slides
- [ ] Settings persist to database and are used by dashboard/signage
- [ ] All configurable values have sensible defaults

### Final Verification:
- [ ] `npm run build` completes without errors
- [ ] `npm test` passes
- [ ] Signage engine starts without errors
- [ ] New slides appear in rotation when enabled
- [ ] Dashboard shows new alerts and metrics correctly

---

## Completion Promise

When ALL phases are complete and ALL verification checks pass, output:

<promise>DASHBOARD AND SIGNAGE IMPROVEMENTS COMPLETE</promise>

---

## Notes for Implementation

1. **Start with Phase 1** - Dashboard improvements are lower risk
2. **Test each component** before moving to the next
3. **Follow existing patterns** - Look at similar existing code for guidance
4. **Maintain type safety** - All new code should have proper TypeScript types
5. **Use existing utilities** - Leverage `src/lib/calendar/utils.ts` and other existing helpers
6. **Database migrations** - Use sequential numbering for new migrations
7. **Git commits** - Commit after each major feature with descriptive messages
