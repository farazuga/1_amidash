# Calendar Feature Implementation Plan

## Summary of Changes

| # | Feature | Complexity | Files Affected |
|---|---------|------------|----------------|
| 1 | Clean up button layout | Low | 1 file |
| 2 | Remove complete status | Medium | 5+ files + DB migration |
| 3 | Click status to bulk change | Medium | 2-3 files |
| 4 | Drag-drop: move assignments + resize | High | 4-5 files |
| 5 | Toast description color fix | Low | 1 file |
| 6 | List view: show dates | Low | 1 file |
| 7 | My Schedule: calendar default | Low | 1 file |
| 8 | Manage Schedule: toggle all days | Low | 1 file |

---

## 1. Clean Up Button Layout/Spacing

**Current State:** Buttons wrap awkwardly on smaller screens. View toggles, action buttons, and filters all compete for space.

**Changes:**
- Group related buttons together with visual separators
- Use consistent sizing (all `sm` buttons)
- Better responsive breakpoints
- Move status filter into a dropdown menu to save horizontal space

**File:** `src/components/calendar/project-calendar.tsx` (lines 396-490)

**Implementation:**
```tsx
// Reorganize toolbar into logical groups:
// Left: Calendar navigation + View toggles
// Right: Actions dropdown (Manage Schedule, Send to Customer) + Status filter + Conflicts
```

---

## 2. Remove Complete Status

**Current State:** 5 statuses: draft, tentative, pending_confirm, confirmed, complete

**New State:** 4 statuses: draft, tentative, pending_confirm, confirmed

**Database Migration Required:**
```sql
-- Migrate existing 'complete' to 'confirmed'
UPDATE project_assignments SET booking_status = 'confirmed' WHERE booking_status = 'complete';

-- Update check constraint
ALTER TABLE project_assignments DROP CONSTRAINT project_assignments_booking_status_check;
ALTER TABLE project_assignments ADD CONSTRAINT project_assignments_booking_status_check
  CHECK (booking_status IN ('draft', 'tentative', 'pending_confirm', 'confirmed'));
```

**Files to Update:**
- `src/types/calendar.ts` - Remove 'complete' from BookingStatus type
- `src/lib/calendar/constants.ts` - Remove complete from BOOKING_STATUS_CONFIG
- `src/components/calendar/project-calendar.tsx` - Remove from filter dropdown, status counts
- `src/components/calendar/calendar-legend.tsx` - Remove from legend
- `src/components/calendar/user-schedule-view.tsx` - Remove from ALL_STATUSES array
- `src/app/(dashboard)/calendar/actions.ts` - Update cycleAssignmentStatus function

**Status Cycle After Change:**
```
draft -> tentative -> confirmed -> draft
(pending_confirm is only set via confirmation flow, not manual cycling)
```

---

## 3. Click Status in Key to Bulk Change All Project Assignments

**Current State:** Status summary bar shows counts but is not interactive

**New Behavior:** Clicking a status dot/label in the summary bar changes ALL assignments for the current project to that status

**File:** `src/components/calendar/project-calendar.tsx` (lines 375-392)

**Implementation:**
```tsx
// Make the status summary bar interactive
const handleBulkStatusChange = async (newStatus: BookingStatus) => {
  const assignmentIds = events.map(e => e.assignmentId);
  await bulkUpdateStatus(projectId, assignmentIds, newStatus);
  toast.success(`All assignments changed to ${BOOKING_STATUS_CONFIG[newStatus].label}`);
};

// In JSX - add onClick and cursor-pointer styling
<div
  key={status}
  className="flex items-center gap-1.5 cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors"
  onClick={() => handleBulkStatusChange(status)}
  title={`Change all to ${config.label}`}
>
```

**New Server Action Needed:** `bulkUpdateAssignmentStatus(projectId, status)` in `actions.ts`

**Confirmation:** Show confirmation dialog before changing (user preference):
```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Change all assignments?</AlertDialogTitle>
      <AlertDialogDescription>
        This will change {count} assignment(s) to "{status}".
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmBulkChange}>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 4. Drag-and-Drop: Move Assignments Between Days + Resize Duration

### 4a. Move Assignments Between Days

**Current State:** Can drag users from sidebar to calendar to create assignments. Cannot move existing assignments.

**New Behavior:** Drag an existing assignment bar to a different day to reschedule

**Files:**
- `src/components/calendar/gantt-calendar.tsx` - Make assignment bars draggable
- `src/components/calendar/week-view-calendar.tsx` - Make event cards draggable
- `src/app/(dashboard)/calendar/actions.ts` - New action to move assignment day

**Implementation:**
1. Wrap assignment bars in `<Draggable>` from @dnd-kit
2. When dropped on different day cell:
   - If single day: update that day's `work_date`
   - If multi-day: ask user "Move all days or just this one?"
3. Check for conflicts before moving

### 4b. Resize Duration (Hourly)

**Current State:** Each assignment day has start_time/end_time (7:00-16:00 default)

**New Behavior:** Drag top/bottom edges of assignment bar to change start/end times

**Time Snap:** 1-hour increments (user preference)

**Implementation:**
1. Add resize handles to assignment bars (top = start time, bottom = end time)
2. Snap to 1-hour increments (7:00, 8:00, 9:00, etc.)
3. On resize end, call `updateAssignmentDayTimes(dayId, start_time, end_time)`

**Complexity Note:** This is the highest complexity feature. Consider:
- Using a library like `react-resizable` or building custom resize handlers
- Visual feedback during resize (ghost preview)
- Conflict detection during resize

---

## 5. Toast Description Color Too Light

**Current State:** Toast descriptions use default sonner styling which may be too light

**Fix:** Add explicit description text color in sonner config

**File:** `src/components/ui/sonner.tsx`

**Implementation:**
```tsx
style={
  {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--border-radius": "var(--radius)",
    // Add description color
    "--description-color": "var(--muted-foreground)",
  } as React.CSSProperties
}
// Or use toastOptions prop:
toastOptions={{
  classNames: {
    description: 'text-muted-foreground !opacity-100',
  }
}}
```

---

## 6. List View: Show Dates Assigned for Each Person

**Current State:** List view shows team members with status badge, but no dates

**New Behavior:** Show the dates each person is scheduled

**File:** `src/app/(dashboard)/projects/[id]/calendar/project-calendar-content.tsx` (lines 136-152)

**Implementation:**
```tsx
// Assignment already has .days array from the fix we made earlier
// Format and display the dates

<div className="flex items-center justify-between p-3 border rounded-lg">
  <div className="flex items-center gap-3">
    {/* Avatar and name - existing */}
  </div>
  <div className="flex items-center gap-3">
    {/* Add dates display */}
    <div className="text-sm text-muted-foreground">
      {formatAssignmentDates(assignment.days)}
    </div>
    <BookingStatusBadge status={assignment.booking_status} />
  </div>
</div>

// Helper function
function formatAssignmentDates(days: AssignmentDay[]): string {
  if (!days?.length) return 'No dates';
  if (days.length === 1) return format(parseISO(days[0].work_date), 'MMM d');
  // Show range or count
  const sorted = [...days].sort((a, b) => a.work_date.localeCompare(b.work_date));
  return `${format(parseISO(sorted[0].work_date), 'MMM d')} - ${format(parseISO(sorted[sorted.length-1].work_date), 'MMM d')}`;
}
```

---

## 7. My Schedule: Show Month Grid Calendar by Default

**Current State:** My Schedule shows a list view (cards for each day with assignments)

**New State:** Full month grid calendar (like project calendar) as default view

**File:** `src/app/(dashboard)/my-schedule/my-schedule-content.tsx`

**Implementation:**
1. Add view toggle: `const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');`
2. Create or reuse a read-only month calendar grid component
3. Show user's assignments on the calendar with status colors
4. Keep list view as secondary option via toggle

---

## 8. Manage Schedule: Click Day to Toggle All Days for Person

**Current State:** Individual checkboxes for each day/person combination

**New Behavior:** Click on a person's row header to:
- If all their days are checked: uncheck all
- If not all checked: check all (within project date range)

**File:** `src/components/calendar/multi-user-assignment-dialog.tsx`

**Implementation:**
```tsx
// Add click handler to user row header
const handleToggleAllForAssignment = (assignmentId: string) => {
  const currentDays = existingDaysMap.get(assignmentId) || new Set();
  const pendingForAssignment = pendingChanges.get(assignmentId) || new Map();

  // Calculate effective state (existing + pending)
  const allDaysSelected = projectDates.every(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const pending = pendingForAssignment.get(dateStr);
    if (pending === 'add') return true;
    if (pending === 'remove') return false;
    return currentDays.has(dateStr);
  });

  // Toggle all dates
  const newChanges = new Map(pendingChanges);
  const assignmentChanges = new Map<string, ChangeAction>();

  projectDates.forEach(date => {
    if (isWeekend(date)) return; // Skip weekends
    const dateStr = format(date, 'yyyy-MM-dd');
    assignmentChanges.set(dateStr, allDaysSelected ? 'remove' : 'add');
  });

  newChanges.set(assignmentId, assignmentChanges);
  setPendingChanges(newChanges);
};

// In JSX - make user name clickable
<div
  className="font-medium cursor-pointer hover:text-primary"
  onClick={() => handleToggleAllForAssignment(assignment.id)}
  title="Click to toggle all days"
>
  {assignment.user?.full_name}
</div>
```

---

## Implementation Order (Recommended)

1. **Low-hanging fruit first:**
   - #5 Toast color fix (5 min)
   - #8 Manage Schedule toggle (30 min)
   - #6 List view dates (30 min)
   - #7 My Schedule calendar default (1 hr)
   - #1 Button layout cleanup (1 hr)

2. **Medium complexity:**
   - #2 Remove complete status (2 hrs including migration)
   - #3 Bulk status change (1 hr)

3. **High complexity:**
   - #4 Drag-drop move + resize (4-8 hrs)

---

## Decisions Made

| Question | Decision |
|----------|----------|
| My Schedule calendar view | **Month grid** (full calendar like project view) |
| Resize time snap | **1-hour increments** |
| Bulk status change | **Show confirmation dialog** before changing |
