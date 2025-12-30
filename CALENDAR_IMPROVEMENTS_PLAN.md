# Calendar Improvements Implementation Plan

## Overview

This document outlines the comprehensive implementation plan for calendar improvements including project schedule status, weekend removal, keyboard shortcuts, undo functionality, and a new Project Calendar page.

## Feature Summary

| # | Feature | Phase | Priority |
|---|---------|-------|----------|
| 1 | Project Schedule Status (draft/tentative/pending/confirmed) | 2 | High |
| 2 | Status Cascade with Confirmation | 2 | High |
| 3 | Remove Weekends Globally | 1 | High |
| 4 | Click-to-Select-All in Manage Schedule | 3 | Medium |
| 5 | Monthly View Taller Days (3→6) | 3 | Medium |
| 6 | Cmd+Drag to Copy Day | 3 | Medium |
| 7 | Option+Click to Delete Day | 3 | Medium |
| 8 | Keyboard Shortcuts Help | 3 | Low |
| 9 | Undo Last Action (Cmd+Z) | 3 | Medium |
| 10 | Project Calendar Page | 4 | High |
| 11 | Project Calendar Filters | 4 | Medium |
| 12 | Conflict Indicators | 4 | Medium |
| 13 | Drag Project Dates | 4 | Low |
| 14 | Today Line Indicator | 1 | Low |
| 15 | Bulk Status Change from Project Calendar | 2 | Medium |
| 16 | Export/Print View | 5 | Low |

---

## Phase 1: Foundation

### 1.1 Database Migration

**File:** `supabase/migrations/020_project_schedule_status.sql`

Add `schedule_status` column to projects table:
- NULL until project has dates
- Automatically set to 'draft' when dates are first added
- Cleared if dates are removed
- Values: 'draft', 'tentative', 'pending_confirm', 'confirmed'

### 1.2 Remove Weekends Globally

**Files to modify:**
- `src/lib/calendar/utils.ts` - Add `isWeekday()` helper
- `src/lib/calendar/constants.ts` - Update WEEKDAYS to Mon-Fri only
- `src/components/calendar/project-calendar.tsx` - 5-column grid
- `src/components/calendar/week-view-calendar.tsx` - Filter weekends
- `src/components/calendar/gantt-calendar.tsx` - Filter weekends
- `src/components/calendar/multi-user-assignment-dialog.tsx` - Remove weekend rows

### 1.3 Today Line Indicator

**New file:** `src/components/calendar/today-indicator.tsx`

Visual vertical line showing current date on all calendar views.

---

## Phase 2: Project Status UI & Cascade

### 2.1 Project Schedule Status Badge

**New files:**
- `src/components/projects/schedule-status-badge.tsx`
- `src/components/projects/schedule-status-select.tsx`

Uses same colors as engineer booking status (BOOKING_STATUS_CONFIG).

### 2.2 Status Cascade Dialog

**New file:** `src/components/calendar/cascade-status-dialog.tsx`

When project schedule_status changes:
1. Show confirmation dialog
2. List all assigned engineers with checkboxes (all selected by default)
3. Allow deselecting individual engineers
4. On confirm, update selected engineer assignments

### 2.3 Server Actions

**Add to:** `src/app/(dashboard)/calendar/actions.ts`
- `updateProjectScheduleStatus()` - Update project schedule_status
- `cascadeStatusToAssignments()` - Bulk update selected assignments

### 2.4 Bulk Status Change

**New file:** `src/components/calendar/bulk-project-status-dialog.tsx`

Select multiple projects on Project Calendar and change their status together.

---

## Phase 3: Calendar Interactions

### 3.1 Click-to-Select-All in Manage Schedule

**Modify:** `src/components/calendar/multi-user-assignment-dialog.tsx`

- Click date row → toggle all engineers for that day
- If all checked → uncheck all
- If any unchecked → check all

### 3.2 Monthly View Taller Days

**Modify:** `src/components/calendar/calendar-day-cell.tsx` and `droppable-day-cell.tsx`

- Default: show 3 people
- Auto-expand: up to 6 people
- If >6: show "+X more" indicator

### 3.3 Cmd+Drag to Copy

**Modify:** `src/components/calendar/project-calendar.tsx`

- Detect Cmd/Ctrl key during drag start
- If held: copy the day instead of moving
- Show copy indicator (+ icon) on drag overlay
- Create new assignment_day without removing original

### 3.4 Option+Click to Delete

**Modify:**
- `src/components/calendar/assignment-card.tsx`
- `src/components/calendar/project-calendar.tsx`

- Detect Alt/Option key on click
- If held: delete that specific day immediately
- Show toast confirmation

### 3.5 Keyboard Shortcuts Help

**New file:** `src/components/calendar/keyboard-shortcuts-help.tsx`

Tooltip showing:
- ⌘ + drag = copy
- ⌥ + click = delete
- ⌘Z = undo

### 3.6 Undo Last Action

**New files:**
- `src/lib/stores/undo-store.ts` - Zustand store for undo stack
- `src/hooks/use-undo-keyboard.ts` - Keyboard listener hook

Features:
- Store last 10 actions
- Each action has undo function
- Cmd+Z triggers undo
- Toast shows what was undone

---

## Phase 4: Project Calendar Page

### 4.1 Navigation

**Modify:** `src/components/layout/sidebar.tsx`

Add "Project Calendar" item after "My Schedule" (visible to all users).

### 4.2 Project Calendar Page

**New files:**
- `src/app/(dashboard)/project-calendar/page.tsx`
- `src/app/(dashboard)/project-calendar/project-calendar-content.tsx`

Features:
- Month view showing all projects with dates
- Color coded by schedule_status
- Click project → navigate to project detail page
- Weekdays only (no weekends)

### 4.3 Filters

**New file:** `src/app/(dashboard)/project-calendar/project-calendar-filters.tsx`

Filter by:
- Schedule status (draft/tentative/pending/confirmed)
- Tag
- Assigned engineer

### 4.4 Conflict Indicators

Show warning icon on projects where engineers have conflicts (double-booked).

### 4.5 Drag Project Dates

Allow dragging project bars to adjust start/end dates directly on calendar.

---

## Phase 5: Export/Print

### 5.1 Print Styles

**New file:** `src/app/(dashboard)/project-calendar/print.css`

Optimized print layout:
- Landscape orientation
- Hide navigation/buttons
- Preserve status colors

### 5.2 Export Button

**New file:** `src/components/calendar/export-calendar-button.tsx`

Options:
- Print (native browser print)
- Export as PDF (using html2canvas + jsPDF)

---

## Phase 6: Testing

### 6.1 Unit Tests

**File:** `src/lib/calendar/__tests__/utils.test.ts`
- `isWeekday()` function
- `getCalendarDays()` excludes weekends
- Date range functions

### 6.2 Integration Tests

**File:** `src/app/(dashboard)/calendar/__tests__/actions.test.ts`
- `cascadeStatusToAssignments()`
- `updateProjectScheduleStatus()`
- Undo functionality

### 6.3 E2E Tests

**Files:**
- `e2e/calendar-interactions.spec.ts` - Drag/drop, keyboard shortcuts
- `e2e/manage-schedule.spec.ts` - Click-to-select, weekend removal
- `e2e/project-calendar.spec.ts` - Navigation, filters, clicking projects

---

## Implementation Order

| Order | Phase | Tasks |
|-------|-------|-------|
| 1 | 1.1 | Database migration |
| 2 | 1.2 | Remove weekends |
| 3 | 1.3 | Today indicator |
| 4 | 2.1-2.2 | Schedule status badge & select |
| 5 | 2.3 | Cascade server actions |
| 6 | 2.4 | Bulk status dialog |
| 7 | 3.1 | Click-to-select-all dates |
| 8 | 3.2 | Taller day cells |
| 9 | 3.3 | Cmd+drag copy |
| 10 | 3.4 | Option+click delete |
| 11 | 3.5 | Shortcuts help |
| 12 | 3.6 | Undo functionality |
| 13 | 4.1 | Navigation update |
| 14 | 4.2 | Project calendar page |
| 15 | 4.3 | Filters |
| 16 | 4.4 | Conflict indicators |
| 17 | 4.5 | Drag project dates |
| 18 | 5.1-5.2 | Export/print |
| 19 | 6.x | All tests |

---

## Keyboard Shortcuts Reference

| Shortcut | Platform | Action |
|----------|----------|--------|
| ⌘ + drag | Mac | Copy assignment to new day |
| Ctrl + drag | Windows | Copy assignment to new day |
| ⌥ + click | Mac | Delete assignment day |
| Alt + click | Windows | Delete assignment day |
| ⌘ + Z | Mac | Undo last action |
| Ctrl + Z | Windows | Undo last action |

---

## Database Schema Changes

```sql
-- New column on projects table
ALTER TABLE projects ADD COLUMN schedule_status TEXT
  CHECK (schedule_status IS NULL OR schedule_status IN (
    'draft', 'tentative', 'pending_confirm', 'confirmed'
  ));

-- Constraint: requires dates
ALTER TABLE projects ADD CONSTRAINT chk_schedule_status_requires_dates
  CHECK (schedule_status IS NULL OR (start_date IS NOT NULL AND end_date IS NOT NULL));
```

---

## Dependencies

New npm packages required:
- `html2canvas` - For PDF export screenshot
- `jspdf` - For PDF generation

---

## Notes

- Schedule status is NULL until project has both start_date and end_date
- When dates are first set, status defaults to 'draft'
- Individual engineer statuses can be overridden after cascade
- Weekends are hidden globally (not a toggle)
- All keyboard shortcuts work cross-platform (Cmd/Ctrl, Option/Alt)
- Undo stores last 10 actions in memory
