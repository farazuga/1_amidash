# Calendar Scheduling System - Implementation Plan v2

> **Created:** December 28, 2024
> **Status:** Ready to Implement
> **Total Tasks:** 49

---

## Executive Summary

This document outlines the complete implementation plan for enhancing the calendar scheduling system with:
- 5-stage booking status workflow (Draft → Tentative → Pending → Confirmed → Complete)
- Customer confirmation portal with magic link emails
- Engineer personal schedule view
- Bulk status operations
- Comprehensive testing via Playwright

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rename `pencil` → `tentative` | Yes | Clearer terminology |
| Add `draft` + `complete` statuses | Yes | Full lifecycle tracking |
| Pending status color | Purple (`#E9D5FF`) | Distinct from other statuses |
| Default working hours | 7:00 AM - 4:00 PM | Per business requirements |
| Draft visibility | Role-based query filter | Non-admins can't see drafts |
| Engineer view location | `/engineer/schedule` | Dedicated route |
| Confirmation email recipient | POC default + override | Flexibility for PM |
| In-app notifications | Toast (Sonner) | Already integrated |
| Bulk status change | Build now | PM efficiency priority |

---

## Phase 1: Database & Types

### 1.1 Migration 017 - Booking Status Update

**File:** `supabase/migrations/017_booking_status_update.sql`

**Purpose:**
- Rename `pencil` to `tentative`
- Add `draft` and `complete` statuses
- Update default working hours to 7am-4pm

**Changes:**
```sql
-- Update booking_status CHECK constraint
CHECK (booking_status IN ('draft', 'tentative', 'pending_confirm', 'confirmed', 'complete'))

-- Migrate existing data
UPDATE project_assignments SET booking_status = 'tentative' WHERE booking_status = 'pencil';

-- Update default working hours
ALTER TABLE assignment_days ALTER COLUMN start_time SET DEFAULT '07:00:00';
ALTER TABLE assignment_days ALTER COLUMN end_time SET DEFAULT '16:00:00';
```

**Rollback Strategy:**
```sql
-- Reverse migration if needed
UPDATE project_assignments SET booking_status = 'pencil' WHERE booking_status = 'tentative';
```

---

### 1.2 Migration 018 - Confirmation Requests

**File:** `supabase/migrations/018_confirmation_requests.sql`

**New Tables:**

#### `confirmation_requests`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | FK to projects |
| token | TEXT | Unique magic link token |
| sent_to_email | TEXT | Recipient email |
| sent_to_name | TEXT | Recipient name (optional) |
| sent_at | TIMESTAMPTZ | When email was sent |
| expires_at | TIMESTAMPTZ | Link expiration (default +7 days) |
| status | TEXT | pending/confirmed/declined/expired |
| responded_at | TIMESTAMPTZ | When customer responded |
| decline_reason | TEXT | Reason if declined |
| created_by | UUID | FK to profiles |

#### `confirmation_request_assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| confirmation_request_id | UUID | FK to confirmation_requests |
| assignment_id | UUID | FK to project_assignments |

**Indexes:**
- `idx_confirmation_requests_token` - Fast token lookup
- `idx_confirmation_requests_project` - Project queries
- `idx_confirmation_requests_expires` - Expiration checks

---

### 1.3 TypeScript Type Updates

**File:** `src/types/calendar.ts`

```typescript
// Updated
export type BookingStatus = 'draft' | 'tentative' | 'pending_confirm' | 'confirmed' | 'complete';

// New
export interface ConfirmationRequest {
  id: string;
  project_id: string;
  token: string;
  sent_to_email: string;
  sent_to_name: string | null;
  sent_at: string;
  expires_at: string;
  status: 'pending' | 'confirmed' | 'declined' | 'expired';
  responded_at: string | null;
  decline_reason: string | null;
  created_by: string | null;
}

export interface ConfirmationPageData {
  project_name: string;
  customer_name: string;
  dates: Array<{
    date: string;
    start_time: string;
    end_time: string;
    engineers: string[];
  }>;
  is_expired: boolean;
  is_responded: boolean;
  previous_response?: 'confirmed' | 'declined';
}
```

---

### 1.4 Constants Update

**File:** `src/lib/calendar/constants.ts`

```typescript
export const BOOKING_STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-800',
    dotColor: 'bg-blue-500',
    visibleToEngineers: false,
  },
  tentative: {
    label: 'Tentative',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-800',
    dotColor: 'bg-amber-500',
    visibleToEngineers: true,
  },
  pending_confirm: {
    label: 'Pending Confirmation',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-800',
    dotColor: 'bg-purple-500',
    visibleToEngineers: true,
  },
  confirmed: {
    label: 'Confirmed',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    textColor: 'text-green-800',
    dotColor: 'bg-green-500',
    visibleToEngineers: true,
  },
  complete: {
    label: 'Complete',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-600',
    dotColor: 'bg-gray-400',
    visibleToEngineers: true,
  },
};

export const DEFAULT_WORKING_HOURS = {
  start: '07:00',
  end: '16:00',
};
```

---

## Phase 2: Backend Actions & Hooks

### 2.1 New Server Actions

**File:** `src/app/(dashboard)/calendar/confirmation-actions.ts`

| Function | Purpose | Auth |
|----------|---------|------|
| `createConfirmationRequest()` | Create request, send email | Admin/Editor |
| `handleConfirmationResponse()` | Process confirm/decline | Public (service client) |
| `getConfirmationRequestByToken()` | Fetch for display | Public (service client) |

### 2.2 Updated Server Actions

**File:** `src/app/(dashboard)/calendar/actions.ts`

| Function | Change |
|----------|--------|
| `cycleAssignmentStatus()` | Handle 5 statuses, skip `pending_confirm` |
| `bulkUpdateAssignmentStatus()` | New - bulk status change |
| `getCalendarData()` | Filter drafts for non-admins |

### 2.3 New React Query Hooks

**File:** `src/hooks/queries/use-assignments.ts`

| Hook | Purpose |
|------|---------|
| `useBulkUpdateAssignmentStatus()` | Bulk status mutation |
| `useCreateConfirmationRequest()` | Send confirmation mutation |
| `useHandleConfirmationResponse()` | Customer response mutation |

---

## Phase 3: PM Features

### 3.1 Component Updates

| Component | File | Changes |
|-----------|------|---------|
| BookingStatusBadge | `booking-status-badge.tsx` | New colors, 5 statuses |
| AssignmentCard | `assignment-card.tsx` | Add "Send to Customer" menu |

### 3.2 New Components

| Component | File | Purpose |
|-----------|------|---------|
| SendConfirmationDialog | `send-confirmation-dialog.tsx` | Email form for PM |
| BulkStatusToolbar | `bulk-status-toolbar.tsx` | Floating toolbar for bulk ops |

### 3.3 Calendar Selection State

Add to `ProjectCalendar`:
- `selectedAssignmentIds: Set<string>` state
- Shift+Click for range selection
- Ctrl/Cmd+Click for multi-select
- Visual selection indicators

---

## Phase 4: Customer & Engineer Views

### 4.1 Customer Confirmation Portal

**Route:** `/confirm/[token]`

**Files:**
- `src/app/confirm/[token]/page.tsx` - Server component
- `src/app/confirm/[token]/confirmation-form.tsx` - Client form

**States Handled:**
- Valid pending request → Show confirm/decline form
- Already responded → Show previous response
- Expired → Show expiration message
- Invalid token → Show error

### 4.2 Engineer Schedule View

**Route:** `/engineer/schedule`

**Files:**
- `src/app/(dashboard)/engineer/schedule/page.tsx`
- `src/components/calendar/engineer-schedule-view.tsx`

**Features:**
- Week view of personal assignments
- Toggle to show/hide tentative
- Drafts never shown
- Mobile responsive

### 4.3 Email Templates

**File:** `src/lib/email/templates.ts`

| Template | Purpose |
|----------|---------|
| `confirmationEmailTemplate()` | Customer confirmation request |
| `pmNotificationEmailTemplate()` | Notify PM on response |

---

## Phase 5: Integration

### 5.1 Middleware Updates

**File:** `src/middleware.ts`

```typescript
// Add to public routes
'/confirm/:token'

// Add to staff routes
'/engineer/schedule'
```

### 5.2 Sidebar Navigation

**File:** `src/components/layout/sidebar.tsx`

Add conditional "My Schedule" link for non-admin users.

---

## Phase 6: Unit & Integration Testing

### 6.1 Unit Tests

| Test | Description | Location |
|------|-------------|----------|
| Migration Data Integrity | Verify pencil→tentative migration | `__tests__/migrations/` |
| Confirmation Token | Verify unique token generation | `__tests__/actions/` |
| Role-Based Filtering | Verify drafts hidden for engineers | `__tests__/actions/` |
| Bulk Update | Verify status change + history | `__tests__/actions/` |

### 6.2 Integration Tests

| Test | Description |
|------|-------------|
| Email Sending | Verify Resend integration with template |
| Status History | Verify audit trail on all status changes |
| RLS Policies | Verify confirmation_requests access control |

---

## Phase 7: E2E Testing (Playwright via MCP)

### 7.1 PM Workflow Tests

| Test ID | Test Case | Steps |
|---------|-----------|-------|
| PM-001 | Create draft assignment | Login → Calendar → Drag user → Verify draft status |
| PM-002 | Change to tentative | Click status → Verify cycles to tentative |
| PM-003 | Send confirmation | Open menu → Send to Customer → Fill email → Submit |
| PM-004 | Receive notification | Customer confirms → Verify toast appears |
| PM-005 | Bulk status change | Select multiple → Change status → Verify all updated |

### 7.2 Customer Workflow Tests

| Test ID | Test Case | Steps |
|---------|-----------|-------|
| CUS-001 | Confirm dates | Open magic link → Click Confirm → Verify success |
| CUS-002 | Decline with reason | Open link → Click Decline → Enter reason → Submit |
| CUS-003 | Expired link | Open expired link → Verify error message |
| CUS-004 | Already responded | Open link again → Verify "already responded" |

### 7.3 Engineer Workflow Tests

| Test ID | Test Case | Steps |
|---------|-----------|-------|
| ENG-001 | View schedule | Login as engineer → Navigate to My Schedule → Verify assignments |
| ENG-002 | Toggle tentative | Click toggle → Verify tentative hidden/shown |
| ENG-003 | Draft hidden | Login → Verify no draft assignments visible |
| ENG-004 | Mobile view | Resize to mobile → Verify responsive layout |

### 7.4 Visual Tests

| Test ID | Test Case | Steps |
|---------|-----------|-------|
| VIS-001 | Status colors | Navigate to calendar → Screenshot → Verify 5 colors |
| VIS-002 | Confirmation page | Open confirm link → Screenshot → Verify branding |
| VIS-003 | Engineer mobile | Resize → Screenshot → Verify layout |

---

## Phase 8: Workflow Integration Tests

### 8.1 Complete PM Workflow

**Test:** `workflow-pm-complete.spec.ts`

```
1. PM logs in
2. PM navigates to calendar
3. PM drags engineer to create assignment (draft)
4. PM clicks status badge → cycles to tentative
5. PM opens assignment menu → "Send to Customer"
6. PM fills email form with POC email
7. PM submits → assignment becomes pending_confirm
8. Verify email would be sent (mock)
9. Customer confirms (via direct action)
10. PM sees toast notification
11. Assignment shows as confirmed
12. PM marks as complete
```

### 8.2 Complete Customer Workflow

**Test:** `workflow-customer-complete.spec.ts`

```
1. Create test confirmation request in DB
2. Navigate to /confirm/[token]
3. Verify project name and dates displayed
4. Verify engineer names shown
5. Click "Confirm Dates"
6. Verify success message
7. Verify assignment status updated in DB
8. Navigate to same link again
9. Verify "Already responded" message
```

### 8.3 Complete Engineer Workflow

**Test:** `workflow-engineer-complete.spec.ts`

```
1. Create test assignments (draft, tentative, confirmed)
2. Login as engineer (non-admin)
3. Navigate to /engineer/schedule
4. Verify only tentative + confirmed visible (no draft)
5. Toggle "Show Tentative" off
6. Verify only confirmed visible
7. Toggle "Show Tentative" on
8. Verify tentative + confirmed visible
9. Resize to mobile
10. Verify responsive layout
```

---

## Task Checklist

### Phase 1: Database & Types (7 tasks)
- [ ] 1. Create migration 017: Update booking statuses
- [ ] 2. Create migration 018: Add confirmation_requests tables
- [ ] 3. Run migrations and verify data integrity
- [ ] 4. Update BookingStatus type
- [ ] 5. Add ConfirmationRequest interfaces
- [ ] 6. Update BOOKING_STATUS_CONFIG constants
- [ ] 7. Update Zod validation schemas

### Phase 2: Backend Actions & Hooks (9 tasks)
- [ ] 8. Create confirmation-actions.ts
- [ ] 9. Add handleConfirmationResponse action
- [ ] 10. Add getConfirmationRequestByToken action
- [ ] 11. Update cycleAssignmentStatus
- [ ] 12. Add bulkUpdateAssignmentStatus action
- [ ] 13. Update getCalendarData with role filtering
- [ ] 14. Add useBulkUpdateAssignmentStatus hook
- [ ] 15. Add useCreateConfirmationRequest hook
- [ ] 16. Add useHandleConfirmationResponse hook

### Phase 3: PM Features (7 tasks)
- [ ] 17. Update BookingStatusBadge colors
- [ ] 18. Create SendConfirmationDialog
- [ ] 19. Create BulkStatusToolbar
- [ ] 20. Add multi-select to ProjectCalendar
- [ ] 21. Add "Send to Customer" to context menu
- [ ] 22. Create confirmationEmailTemplate
- [ ] 23. Create pmNotificationEmailTemplate

### Phase 4: Customer & Engineer Views (5 tasks)
- [ ] 24. Create /confirm/[token] page
- [ ] 25. Create ConfirmationForm component
- [ ] 26. Create /engineer/schedule page
- [ ] 27. Create EngineerScheduleView component
- [ ] 28. Update sidebar navigation

### Phase 5: Integration (1 task)
- [ ] 29. Update middleware for /confirm route

### Phase 6: Unit & Integration Tests (5 tasks)
- [ ] 30. Unit Test: Booking status migration
- [ ] 31. Unit Test: Confirmation request creation
- [ ] 32. Unit Test: Role-based draft filtering
- [ ] 33. Unit Test: Bulk status update
- [ ] 34. Integration Test: Email sending

### Phase 7: E2E Tests - Playwright (12 tasks)
- [ ] 35. E2E: PM creates draft assignment
- [ ] 36. E2E: PM changes to tentative
- [ ] 37. E2E: PM sends confirmation request
- [ ] 38. E2E: Customer confirms dates
- [ ] 39. E2E: Customer declines with reason
- [ ] 40. E2E: PM receives notification
- [ ] 41. E2E: Engineer views schedule
- [ ] 42. E2E: Engineer cannot see drafts
- [ ] 43. E2E: PM bulk status change
- [ ] 44. E2E: Verify status colors
- [ ] 45. E2E: Mobile responsive test
- [ ] 46. E2E: Expired link handling

### Phase 8: Workflow Tests (3 tasks)
- [ ] 47. Complete PM scheduling workflow
- [ ] 48. Complete customer confirmation workflow
- [ ] 49. Complete engineer view workflow

---

## Playwright Test Structure

```
/e2e/
├── fixtures/
│   ├── auth.ts           # Login helpers
│   └── test-data.ts      # Test data setup
├── pm/
│   ├── assignment.spec.ts
│   ├── bulk-operations.spec.ts
│   └── send-confirmation.spec.ts
├── customer/
│   ├── confirmation.spec.ts
│   └── decline.spec.ts
├── engineer/
│   └── schedule.spec.ts
├── visual/
│   └── status-colors.spec.ts
└── workflows/
    ├── pm-complete.spec.ts
    ├── customer-complete.spec.ts
    └── engineer-complete.spec.ts
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Migration breaks existing data | Test on staging first, create rollback script |
| Email delivery fails | Implement retry logic, log failures |
| Token collision | Use crypto-secure 32-byte tokens |
| RLS blocks legitimate access | Test with all user roles |
| Mobile layout breaks | Test on multiple screen sizes |

---

## Success Criteria

1. **All 5 statuses** display with correct colors
2. **PM can send** confirmation emails from tentative assignments
3. **Customers can confirm/decline** via magic link without login
4. **Engineers see** their schedule with tentative toggle
5. **Drafts are hidden** from non-admin users
6. **Bulk operations** work for multiple assignments
7. **All E2E tests** pass in Playwright
8. **Mobile responsive** on all new pages
