# Calendar Scheduling System - Implementation Plan

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Rename `pencil` → `tentative` | Yes, add `draft` + `complete` |
| Pending status color | Purple (`#E9D5FF` / `#7C3AED`) |
| Default working hours | 7:00 AM - 4:00 PM |
| Draft visibility | Role-based query filter (non-admins can't see drafts) |
| Engineer view location | New route `/engineer/schedule` |
| Confirmation email recipient | POC by default + allow override |
| In-app notifications | Toast notifications (Sonner) |
| Bulk status change | Build now (Phase 1) |

---

## Phase 1: Database & Backend Foundation

### 1.1 Database Migration - Booking Status Update

**File:** `supabase/migrations/017_booking_status_update.sql`

```sql
-- Migration: Update booking status values and add new statuses
-- This migration:
-- 1. Renames 'pencil' to 'tentative'
-- 2. Adds 'draft' and 'complete' statuses
-- 3. Updates default working hours to 7am-4pm

BEGIN;

-- Step 1: Add temporary column
ALTER TABLE project_assignments ADD COLUMN booking_status_new TEXT;

-- Step 2: Migrate existing data
UPDATE project_assignments
SET booking_status_new = CASE
  WHEN booking_status = 'pencil' THEN 'tentative'
  ELSE booking_status
END;

-- Step 3: Drop old constraint
ALTER TABLE project_assignments DROP CONSTRAINT project_assignments_booking_status_check;

-- Step 4: Drop old column and rename new
ALTER TABLE project_assignments DROP COLUMN booking_status;
ALTER TABLE project_assignments RENAME COLUMN booking_status_new TO booking_status;

-- Step 5: Add new constraint with all statuses
ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_booking_status_check
CHECK (booking_status IN ('draft', 'tentative', 'pending_confirm', 'confirmed', 'complete'));

-- Step 6: Set default and NOT NULL
ALTER TABLE project_assignments
ALTER COLUMN booking_status SET DEFAULT 'draft',
ALTER COLUMN booking_status SET NOT NULL;

-- Step 7: Update booking_status_history to handle renamed status
UPDATE booking_status_history
SET old_status = 'tentative' WHERE old_status = 'pencil';
UPDATE booking_status_history
SET new_status = 'tentative' WHERE new_status = 'pencil';

-- Step 8: Update default working hours
ALTER TABLE assignment_days
ALTER COLUMN start_time SET DEFAULT '07:00:00';
ALTER TABLE assignment_days
ALTER COLUMN end_time SET DEFAULT '16:00:00';

COMMIT;
```

**Tasks:**
- [ ] Create migration file
- [ ] Test migration on local Supabase
- [ ] Update TypeScript types
- [ ] Update validation schemas

---

### 1.2 Database Migration - Confirmation Requests

**File:** `supabase/migrations/018_confirmation_requests.sql`

```sql
-- Migration: Add customer confirmation request system

BEGIN;

-- Table: confirmation_requests
CREATE TABLE confirmation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  sent_to_email TEXT NOT NULL,
  sent_to_name TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'declined', 'expired')) DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Link assignments to confirmation requests
CREATE TABLE confirmation_request_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_request_id UUID NOT NULL REFERENCES confirmation_requests(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(confirmation_request_id, assignment_id)
);

-- Indexes
CREATE INDEX idx_confirmation_requests_project ON confirmation_requests(project_id);
CREATE INDEX idx_confirmation_requests_token ON confirmation_requests(token);
CREATE INDEX idx_confirmation_requests_status ON confirmation_requests(status);
CREATE INDEX idx_confirmation_requests_expires ON confirmation_requests(expires_at);
CREATE INDEX idx_confirmation_request_assignments_request ON confirmation_request_assignments(confirmation_request_id);
CREATE INDEX idx_confirmation_request_assignments_assignment ON confirmation_request_assignments(assignment_id);

-- RLS Policies
ALTER TABLE confirmation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_request_assignments ENABLE ROW LEVEL SECURITY;

-- View: All authenticated users can view
CREATE POLICY "Authenticated users can view confirmation requests"
  ON confirmation_requests FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Admin/Editor only
CREATE POLICY "Admin/Editor can create confirmation requests"
  ON confirmation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

-- Update: Admin/Editor OR via public token (for customer response)
CREATE POLICY "Admin/Editor can update confirmation requests"
  ON confirmation_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

-- Public update policy for customer confirmation (via service role)
-- Note: Customer confirmation will use service client

-- Similar policies for confirmation_request_assignments
CREATE POLICY "Authenticated users can view confirmation request assignments"
  ON confirmation_request_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Editor can manage confirmation request assignments"
  ON confirmation_request_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

COMMIT;
```

**Tasks:**
- [ ] Create migration file
- [ ] Test migration on local Supabase
- [ ] Create TypeScript types for new tables

---

### 1.3 TypeScript Types Update

**File:** `src/types/calendar.ts` - Updates

```typescript
// Update BookingStatus type
export type BookingStatus = 'draft' | 'tentative' | 'pending_confirm' | 'confirmed' | 'complete';

// Add confirmation request types
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
  created_at: string;
}

export interface ConfirmationRequestWithAssignments extends ConfirmationRequest {
  project: {
    id: string;
    client_name: string;
    poc_name: string | null;
    poc_email: string | null;
  };
  assignments: Array<{
    id: string;
    user: {
      id: string;
      full_name: string;
      email: string;
    };
    assignment_days: AssignmentDay[];
  }>;
}

// For the confirmation portal page
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

**Tasks:**
- [ ] Update `BookingStatus` type
- [ ] Add `ConfirmationRequest` interface
- [ ] Add `ConfirmationRequestWithAssignments` interface
- [ ] Add `ConfirmationPageData` interface
- [ ] Update all imports that use `BookingStatus`

---

### 1.4 Update Status Colors & Constants

**File:** `src/lib/calendar/constants.ts` - Updates

```typescript
export const BOOKING_STATUS_CONFIG: Record<BookingStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  description: string;
  visibleToEngineers: boolean;
}> = {
  draft: {
    label: 'Draft',
    color: 'blue',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-800',
    dotColor: 'bg-blue-500',
    description: 'PM planning - not visible to engineers',
    visibleToEngineers: false,
  },
  tentative: {
    label: 'Tentative',
    color: 'amber',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-800',
    dotColor: 'bg-amber-500',
    description: 'Planned but not yet sent to customer',
    visibleToEngineers: true,
  },
  pending_confirm: {
    label: 'Pending Confirmation',
    color: 'purple',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-800',
    dotColor: 'bg-purple-500',
    description: 'Awaiting customer confirmation',
    visibleToEngineers: true,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'green',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    textColor: 'text-green-800',
    dotColor: 'bg-green-500',
    description: 'Customer confirmed',
    visibleToEngineers: true,
  },
  complete: {
    label: 'Complete',
    color: 'gray',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-600',
    dotColor: 'bg-gray-400',
    description: 'Work completed',
    visibleToEngineers: true,
  },
};

// Status cycle order (for PM cycling through statuses)
export const BOOKING_STATUS_CYCLE: BookingStatus[] = [
  'draft',
  'tentative',
  'pending_confirm',
  'confirmed',
  'complete'
];

// Default working hours
export const DEFAULT_WORKING_HOURS = {
  start: '07:00',
  end: '16:00',
} as const;
```

**Tasks:**
- [ ] Update `BOOKING_STATUS_CONFIG` with new statuses and colors
- [ ] Add `visibleToEngineers` flag to each status
- [ ] Update `BOOKING_STATUS_CYCLE` array
- [ ] Add `DEFAULT_WORKING_HOURS` constant
- [ ] Update any hardcoded `08:00`/`17:00` references

---

### 1.5 Update Validation Schemas

**File:** `src/lib/validation.ts` - Updates

```typescript
// Update booking status schema
export const bookingStatusSchema = z.enum([
  'draft',
  'tentative',
  'pending_confirm',
  'confirmed',
  'complete'
]);

// Add confirmation request schemas
export const confirmationRequestSchema = z.object({
  projectId: z.string().uuid(),
  assignmentIds: z.array(z.string().uuid()).min(1),
  sendToEmail: z.string().email(),
  sendToName: z.string().optional(),
});

export const confirmationResponseSchema = z.object({
  token: z.string().min(1),
  action: z.enum(['confirm', 'decline']),
  declineReason: z.string().optional(),
});

// Time validation (for 7am-4pm range)
export const workingTimeSchema = z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/);

export const assignmentDaySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: workingTimeSchema.default('07:00'),
  endTime: workingTimeSchema.default('16:00'),
}).refine(data => data.endTime > data.startTime, {
  message: 'End time must be after start time',
});
```

**Tasks:**
- [ ] Update `bookingStatusSchema`
- [ ] Add `confirmationRequestSchema`
- [ ] Add `confirmationResponseSchema`
- [ ] Add `workingTimeSchema`
- [ ] Update `assignmentDaySchema` defaults

---

## Phase 2: Backend Server Actions

### 2.1 Confirmation Request Actions

**File:** `src/app/(dashboard)/calendar/confirmation-actions.ts` - New

```typescript
'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email/send';
import { confirmationEmailTemplate } from '@/lib/email/templates';

// Types
interface CreateConfirmationRequestParams {
  projectId: string;
  assignmentIds: string[];
  sendToEmail: string;
  sendToName?: string;
}

interface ConfirmationResponse {
  token: string;
  action: 'confirm' | 'decline';
  declineReason?: string;
}

// Create confirmation request and send email
export async function createConfirmationRequest(
  params: CreateConfirmationRequestParams
): Promise<ActionResult<{ id: string; token: string }>> {
  const supabase = await createClient();

  // Check user is admin/editor
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'editor'].includes(profile.role)) {
    return { success: false, error: 'Insufficient permissions' };
  }

  // Get project details
  const { data: project } = await supabase
    .from('projects')
    .select('id, client_name, poc_name, poc_email')
    .eq('id', params.projectId)
    .single();

  if (!project) return { success: false, error: 'Project not found' };

  // Get assignments with days and user info
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select(`
      id,
      user:profiles!project_assignments_user_id_fkey(id, full_name, email),
      assignment_days(work_date, start_time, end_time)
    `)
    .in('id', params.assignmentIds);

  if (!assignments?.length) {
    return { success: false, error: 'No assignments found' };
  }

  // Create confirmation request
  const { data: request, error } = await supabase
    .from('confirmation_requests')
    .insert({
      project_id: params.projectId,
      sent_to_email: params.sendToEmail,
      sent_to_name: params.sendToName,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Link assignments to request
  const assignmentLinks = params.assignmentIds.map(assignmentId => ({
    confirmation_request_id: request.id,
    assignment_id: assignmentId,
  }));

  await supabase
    .from('confirmation_request_assignments')
    .insert(assignmentLinks);

  // Update assignment statuses to pending_confirm
  await supabase
    .from('project_assignments')
    .update({ booking_status: 'pending_confirm' })
    .in('id', params.assignmentIds);

  // Record status change in history
  for (const assignmentId of params.assignmentIds) {
    await supabase.from('booking_status_history').insert({
      assignment_id: assignmentId,
      old_status: 'tentative', // Assuming coming from tentative
      new_status: 'pending_confirm',
      changed_by: user.id,
      note: `Sent confirmation request to ${params.sendToEmail}`,
    });
  }

  // Send confirmation email
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/confirm/${request.token}`;

  const emailHtml = confirmationEmailTemplate({
    customerName: params.sendToName || project.poc_name || 'Customer',
    projectName: project.client_name,
    assignments: assignments.map(a => ({
      engineerName: a.user.full_name,
      days: a.assignment_days.map(d => ({
        date: d.work_date,
        startTime: d.start_time,
        endTime: d.end_time,
      })),
    })),
    confirmUrl,
    expiresAt: request.expires_at,
  });

  const emailResult = await sendEmail({
    to: params.sendToEmail,
    subject: `Please confirm your project dates - ${project.client_name}`,
    html: emailHtml,
  });

  if (!emailResult.success) {
    // Log but don't fail - request was created
    console.error('Failed to send confirmation email:', emailResult.error);
  }

  revalidatePath('/calendar');

  return {
    success: true,
    data: { id: request.id, token: request.token }
  };
}

// Handle customer confirmation response (public - uses service client)
export async function handleConfirmationResponse(
  params: ConfirmationResponse
): Promise<ActionResult<void>> {
  // Use service client since this is a public action
  const supabase = createServiceClient();

  // Get confirmation request
  const { data: request } = await supabase
    .from('confirmation_requests')
    .select(`
      *,
      project:projects(id, client_name),
      confirmation_request_assignments(
        assignment:project_assignments(id, booking_status)
      )
    `)
    .eq('token', params.token)
    .single();

  if (!request) {
    return { success: false, error: 'Invalid or expired link' };
  }

  // Check if already responded
  if (request.status !== 'pending') {
    return { success: false, error: 'This request has already been responded to' };
  }

  // Check if expired
  if (new Date(request.expires_at) < new Date()) {
    await supabase
      .from('confirmation_requests')
      .update({ status: 'expired' })
      .eq('id', request.id);
    return { success: false, error: 'This confirmation link has expired' };
  }

  const newStatus = params.action === 'confirm' ? 'confirmed' : 'declined';
  const newBookingStatus = params.action === 'confirm' ? 'confirmed' : 'tentative';

  // Update confirmation request
  await supabase
    .from('confirmation_requests')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
      decline_reason: params.declineReason,
    })
    .eq('id', request.id);

  // Update assignment statuses
  const assignmentIds = request.confirmation_request_assignments.map(
    (cra: any) => cra.assignment.id
  );

  await supabase
    .from('project_assignments')
    .update({ booking_status: newBookingStatus })
    .in('id', assignmentIds);

  // Record status changes
  for (const assignmentId of assignmentIds) {
    await supabase.from('booking_status_history').insert({
      assignment_id: assignmentId,
      old_status: 'pending_confirm',
      new_status: newBookingStatus,
      note: params.action === 'confirm'
        ? 'Customer confirmed via portal'
        : `Customer declined: ${params.declineReason || 'No reason provided'}`,
    });
  }

  // TODO: Send notification to PM (toast will be handled client-side)
  // For now, we can send an email to the PM

  return { success: true };
}

// Get confirmation request details (for public page)
export async function getConfirmationRequestByToken(
  token: string
): Promise<ActionResult<ConfirmationPageData>> {
  const supabase = createServiceClient();

  const { data: request } = await supabase
    .from('confirmation_requests')
    .select(`
      *,
      project:projects(id, client_name, poc_name),
      confirmation_request_assignments(
        assignment:project_assignments(
          id,
          user:profiles!project_assignments_user_id_fkey(full_name),
          assignment_days(work_date, start_time, end_time)
        )
      )
    `)
    .eq('token', token)
    .single();

  if (!request) {
    return { success: false, error: 'Invalid confirmation link' };
  }

  // Group by date with engineers
  const dateMap = new Map<string, {
    date: string;
    start_time: string;
    end_time: string;
    engineers: string[];
  }>();

  for (const cra of request.confirmation_request_assignments) {
    const assignment = cra.assignment;
    for (const day of assignment.assignment_days) {
      const key = `${day.work_date}-${day.start_time}-${day.end_time}`;
      if (!dateMap.has(key)) {
        dateMap.set(key, {
          date: day.work_date,
          start_time: day.start_time,
          end_time: day.end_time,
          engineers: [],
        });
      }
      dateMap.get(key)!.engineers.push(assignment.user.full_name);
    }
  }

  const dates = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
  );

  return {
    success: true,
    data: {
      project_name: request.project.client_name,
      customer_name: request.project.poc_name || 'Customer',
      dates,
      is_expired: new Date(request.expires_at) < new Date(),
      is_responded: request.status !== 'pending',
      previous_response: request.status === 'pending' ? undefined : request.status,
    },
  };
}
```

**Tasks:**
- [ ] Create `confirmation-actions.ts` file
- [ ] Implement `createConfirmationRequest`
- [ ] Implement `handleConfirmationResponse`
- [ ] Implement `getConfirmationRequestByToken`
- [ ] Add email template for confirmation
- [ ] Add PM notification on response

---

### 2.2 Update Existing Calendar Actions

**File:** `src/app/(dashboard)/calendar/actions.ts` - Updates

```typescript
// Update cycleAssignmentStatus to handle new statuses
export async function cycleAssignmentStatus(
  assignmentId: string
): Promise<ActionResult<BookingStatus>> {
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from('project_assignments')
    .select('booking_status')
    .eq('id', assignmentId)
    .single();

  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }

  const currentIndex = BOOKING_STATUS_CYCLE.indexOf(assignment.booking_status);
  const nextIndex = (currentIndex + 1) % BOOKING_STATUS_CYCLE.length;
  const newStatus = BOOKING_STATUS_CYCLE[nextIndex];

  // Don't cycle to pending_confirm - that requires sending to customer
  if (newStatus === 'pending_confirm') {
    const skipIndex = (nextIndex + 1) % BOOKING_STATUS_CYCLE.length;
    return cycleToStatus(assignmentId, BOOKING_STATUS_CYCLE[skipIndex]);
  }

  return cycleToStatus(assignmentId, newStatus);
}

// Add bulk status update
export async function bulkUpdateAssignmentStatus(
  assignmentIds: string[],
  newStatus: BookingStatus
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  // Check permissions
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'editor'].includes(profile.role)) {
    return { success: false, error: 'Insufficient permissions' };
  }

  // Get current statuses for history
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('id, booking_status')
    .in('id', assignmentIds);

  if (!assignments?.length) {
    return { success: false, error: 'No assignments found' };
  }

  // Update all assignments
  const { error } = await supabase
    .from('project_assignments')
    .update({
      booking_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .in('id', assignmentIds);

  if (error) return { success: false, error: error.message };

  // Record history for each
  for (const assignment of assignments) {
    if (assignment.booking_status !== newStatus) {
      await supabase.from('booking_status_history').insert({
        assignment_id: assignment.id,
        old_status: assignment.booking_status,
        new_status: newStatus,
        changed_by: user.id,
        note: 'Bulk status update',
      });
    }
  }

  revalidatePath('/calendar');
  return { success: true };
}

// Update getCalendarData to filter drafts for non-admins
export async function getCalendarData(
  startDate: string,
  endDate: string,
  options?: { includeAllStatuses?: boolean }
): Promise<ActionResult<CalendarData>> {
  const supabase = await createClient();

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'editor';

  let query = supabase
    .from('project_assignments')
    .select(`
      *,
      project:projects(*),
      user:profiles!project_assignments_user_id_fkey(*),
      assignment_days(*)
    `);

  // Filter out drafts for non-admins unless explicitly requested
  if (!isAdmin && !options?.includeAllStatuses) {
    query = query.neq('booking_status', 'draft');
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };

  return { success: true, data };
}
```

**Tasks:**
- [ ] Update `cycleAssignmentStatus` to skip `pending_confirm`
- [ ] Add `bulkUpdateAssignmentStatus` action
- [ ] Update `getCalendarData` to filter drafts based on role
- [ ] Update all queries that return assignments to check role
- [ ] Add status change history recording

---

### 2.3 React Query Hooks Update

**File:** `src/hooks/queries/use-assignments.ts` - Updates

```typescript
// Add hook for bulk status update
export function useBulkUpdateAssignmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assignmentIds,
      newStatus
    }: {
      assignmentIds: string[];
      newStatus: BookingStatus
    }) => {
      const result = await bulkUpdateAssignmentStatus(assignmentIds, newStatus);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['gantt'] });
      toast.success('Statuses updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update statuses');
    },
  });
}

// Add hook for confirmation requests
export function useCreateConfirmationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateConfirmationRequestParams) => {
      const result = await createConfirmationRequest(params);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Confirmation request sent!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send confirmation request');
    },
  });
}

// Add hook for confirmation response
export function useHandleConfirmationResponse() {
  return useMutation({
    mutationFn: async (params: ConfirmationResponse) => {
      const result = await handleConfirmationResponse(params);
      if (!result.success) throw new Error(result.error);
      return result;
    },
  });
}
```

**Tasks:**
- [ ] Add `useBulkUpdateAssignmentStatus` hook
- [ ] Add `useCreateConfirmationRequest` hook
- [ ] Add `useHandleConfirmationResponse` hook
- [ ] Update existing hooks to use new status values

---

## Phase 3: Frontend Components

### 3.1 Update BookingStatusBadge

**File:** `src/components/calendar/booking-status-badge.tsx` - Updates

```typescript
// Update to use new color config and handle all 5 statuses
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';

export function BookingStatusBadge({
  status,
  size = 'md',
  showLabel = true,
}: BookingStatusBadgeProps) {
  const config = BOOKING_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.bgColor,
        config.borderColor,
        config.textColor,
        sizeClasses[size]
      )}
      title={config.description}
    >
      <span className={cn('rounded-full', config.dotColor, dotSizeClasses[size])} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
```

**Tasks:**
- [ ] Update component to use `BOOKING_STATUS_CONFIG`
- [ ] Add tooltip with status description
- [ ] Test all 5 status colors

---

### 3.2 Send to Customer Dialog

**File:** `src/components/calendar/send-confirmation-dialog.tsx` - New

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateConfirmationRequest } from '@/hooks/queries/use-assignments';
import { Send, Mail } from 'lucide-react';

interface SendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  assignmentIds: string[];
  defaultEmail?: string;
  defaultName?: string;
}

export function SendConfirmationDialog({
  open,
  onOpenChange,
  projectId,
  assignmentIds,
  defaultEmail,
  defaultName,
}: SendConfirmationDialogProps) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [name, setName] = useState(defaultName || '');

  const { mutate: sendConfirmation, isPending } = useCreateConfirmationRequest();

  const handleSend = () => {
    sendConfirmation({
      projectId,
      assignmentIds,
      sendToEmail: email,
      sendToName: name || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Confirmation Request
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Send a confirmation email to the customer. They will receive a link
            to confirm or decline the scheduled dates.
          </p>

          <div className="grid gap-2">
            <Label htmlFor="name">Recipient Name</Label>
            <Input
              id="name"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Recipient Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">This will:</p>
            <ul className="list-disc list-inside mt-1 text-muted-foreground">
              <li>Change status to "Pending Confirmation"</li>
              <li>Send an email with a confirmation link</li>
              <li>Link expires in 7 days</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!email || isPending}
          >
            <Mail className="mr-2 h-4 w-4" />
            {isPending ? 'Sending...' : 'Send Confirmation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Tasks:**
- [ ] Create `SendConfirmationDialog` component
- [ ] Add to assignment card/row context menu
- [ ] Pre-fill with project POC email
- [ ] Show loading state during send

---

### 3.3 Bulk Status Change UI

**File:** `src/components/calendar/bulk-status-toolbar.tsx` - New

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookingStatusBadge } from './booking-status-badge';
import { useBulkUpdateAssignmentStatus } from '@/hooks/queries/use-assignments';
import { BOOKING_STATUS_CONFIG, BOOKING_STATUS_CYCLE } from '@/lib/calendar/constants';
import { X, ChevronDown, CheckSquare } from 'lucide-react';
import type { BookingStatus } from '@/types/calendar';

interface BulkStatusToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkStatusToolbar({
  selectedIds,
  onClearSelection
}: BulkStatusToolbarProps) {
  const { mutate: bulkUpdate, isPending } = useBulkUpdateAssignmentStatus();

  if (selectedIds.length === 0) return null;

  const handleStatusChange = (newStatus: BookingStatus) => {
    bulkUpdate({
      assignmentIds: selectedIds,
      newStatus
    }, {
      onSuccess: () => {
        onClearSelection();
      },
    });
  };

  // Filter out pending_confirm from bulk options (requires confirmation flow)
  const availableStatuses = BOOKING_STATUS_CYCLE.filter(
    s => s !== 'pending_confirm'
  );

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-background border rounded-lg shadow-lg p-2">
        <span className="flex items-center gap-2 px-2 text-sm font-medium">
          <CheckSquare className="h-4 w-4" />
          {selectedIds.length} selected
        </span>

        <div className="h-6 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Change Status
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {availableStatuses.map(status => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status)}
              >
                <BookingStatusBadge status={status} size="sm" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Tasks:**
- [ ] Create `BulkStatusToolbar` component
- [ ] Add selection state to calendar views
- [ ] Integrate toolbar with Gantt and Week views
- [ ] Add Shift+Click for range selection
- [ ] Add Ctrl/Cmd+Click for multi-select

---

### 3.4 Customer Confirmation Page

**File:** `src/app/confirm/[token]/page.tsx` - New

```typescript
import { getConfirmationRequestByToken } from '@/app/(dashboard)/calendar/confirmation-actions';
import { ConfirmationForm } from './confirmation-form';
import { format } from 'date-fns';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ConfirmPageProps {
  params: { token: string };
}

export default async function ConfirmPage({ params }: ConfirmPageProps) {
  const result = await getConfirmationRequestByToken(params.token);

  if (!result.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground">
            {result.error || 'This confirmation link is invalid or has expired.'}
          </p>
        </div>
      </div>
    );
  }

  const { data } = result;

  // Already responded
  if (data.is_responded) {
    const Icon = data.previous_response === 'confirmed' ? CheckCircle : XCircle;
    const color = data.previous_response === 'confirmed' ? 'text-green-500' : 'text-red-500';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Icon className={`h-12 w-12 ${color} mx-auto mb-4`} />
          <h1 className="text-xl font-semibold mb-2">
            {data.previous_response === 'confirmed' ? 'Already Confirmed' : 'Already Declined'}
          </h1>
          <p className="text-muted-foreground">
            You have already responded to this confirmation request.
          </p>
        </div>
      </div>
    );
  }

  // Expired
  if (data.is_expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Link Expired</h1>
          <p className="text-muted-foreground">
            This confirmation link has expired. Please contact us to request a new link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#023A2D] text-white p-6">
            <h1 className="text-2xl font-bold">Confirm Project Schedule</h1>
            <p className="text-white/80 mt-1">
              {data.project_name}
            </p>
          </div>

          <div className="p-6">
            <p className="text-muted-foreground mb-6">
              Hi {data.customer_name}, please review and confirm the scheduled dates below.
            </p>

            {/* Schedule Table */}
            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Engineer(s)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.dates.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(item.date), 'EEEE, MMMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {item.engineers.join(', ')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirmation Form */}
            <ConfirmationForm token={params.token} />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Questions? Contact us at support@amitrace.com
        </p>
      </div>
    </div>
  );
}
```

**File:** `src/app/confirm/[token]/confirmation-form.tsx` - New

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHandleConfirmationResponse } from '@/hooks/queries/use-assignments';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ConfirmationFormProps {
  token: string;
}

export function ConfirmationForm({ token }: ConfirmationFormProps) {
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [success, setSuccess] = useState<'confirmed' | 'declined' | null>(null);

  const { mutate: respond, isPending } = useHandleConfirmationResponse();

  const handleConfirm = () => {
    respond({ token, action: 'confirm' }, {
      onSuccess: () => setSuccess('confirmed'),
    });
  };

  const handleDecline = () => {
    if (!showDeclineReason) {
      setShowDeclineReason(true);
      return;
    }

    respond({
      token,
      action: 'decline',
      declineReason: declineReason || undefined
    }, {
      onSuccess: () => setSuccess('declined'),
    });
  };

  if (success) {
    const Icon = success === 'confirmed' ? CheckCircle : XCircle;
    const color = success === 'confirmed' ? 'text-green-500' : 'text-red-500';
    const message = success === 'confirmed'
      ? 'Thank you! The dates have been confirmed.'
      : 'The dates have been declined. We will contact you shortly.';

    return (
      <div className="text-center py-8">
        <Icon className={`h-16 w-16 ${color} mx-auto mb-4`} />
        <p className="text-lg font-medium">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showDeclineReason && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Reason for declining (optional)
          </label>
          <Textarea
            placeholder="Please let us know why these dates don't work, or suggest alternatives..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={handleConfirm}
          disabled={isPending || showDeclineReason}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Confirm Dates
        </Button>

        <Button
          variant={showDeclineReason ? 'default' : 'outline'}
          className={showDeclineReason ? 'flex-1 bg-red-600 hover:bg-red-700' : 'flex-1'}
          onClick={handleDecline}
          disabled={isPending}
        >
          {isPending && showDeclineReason ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-2 h-4 w-4" />
          )}
          {showDeclineReason ? 'Submit Decline' : 'Decline'}
        </Button>
      </div>

      {showDeclineReason && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowDeclineReason(false)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
```

**Tasks:**
- [ ] Create `/confirm/[token]/page.tsx`
- [ ] Create `ConfirmationForm` client component
- [ ] Style with Amitrace branding
- [ ] Handle all states (pending, expired, already responded)
- [ ] Mobile responsive design

---

### 3.5 Engineer Schedule Page

**File:** `src/app/(dashboard)/engineer/schedule/page.tsx` - New

```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { EngineerScheduleView } from '@/components/calendar/engineer-schedule-view';

export default async function EngineerSchedulePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="text-muted-foreground">
          View your assigned projects and schedule
        </p>
      </div>

      <EngineerScheduleView userId={profile.id} userName={profile.full_name} />
    </div>
  );
}
```

**File:** `src/components/calendar/engineer-schedule-view.tsx` - New

```typescript
'use client';

import { useState } from 'react';
import { useUserAssignments } from '@/hooks/queries/use-assignments';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns';
import { BookingStatusBadge } from './booking-status-badge';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import type { BookingStatus } from '@/types/calendar';

interface EngineerScheduleViewProps {
  userId: string;
  userName: string;
}

export function EngineerScheduleView({ userId, userName }: EngineerScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTentative, setShowTentative] = useState(true);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: assignments, isLoading } = useUserAssignments(
    userId,
    format(weekStart, 'yyyy-MM-dd'),
    format(weekEnd, 'yyyy-MM-dd')
  );

  // Filter based on toggle
  const filteredAssignments = assignments?.filter(a => {
    if (a.booking_status === 'draft') return false; // Never show drafts
    if (!showTentative && a.booking_status === 'tentative') return false;
    return true;
  }) || [];

  // Group by day
  const assignmentsByDay = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayAssignments = filteredAssignments.filter(a =>
      a.assignment_days?.some(d => d.work_date === dateStr)
    );
    return { date: day, assignments: dayAssignments };
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="font-medium ml-2">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="show-tentative"
            checked={showTentative}
            onCheckedChange={setShowTentative}
          />
          <Label htmlFor="show-tentative" className="text-sm">
            Show Tentative
          </Label>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(BOOKING_STATUS_CONFIG)
          .filter(([key]) => key !== 'draft')
          .map(([status, config]) => (
            <div key={status} className="flex items-center gap-2">
              <BookingStatusBadge status={status as BookingStatus} size="sm" />
            </div>
          ))}
      </div>

      {/* Week View */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {assignmentsByDay.map(({ date, assignments }) => (
          <div
            key={date.toISOString()}
            className="border rounded-lg overflow-hidden"
          >
            <div className={`p-2 text-center font-medium ${
              format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              <div className="text-xs uppercase">{format(date, 'EEE')}</div>
              <div className="text-lg">{format(date, 'd')}</div>
            </div>

            <div className="p-2 space-y-2 min-h-[100px]">
              {assignments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No assignments
                </p>
              ) : (
                assignments.map(assignment => {
                  const dayData = assignment.assignment_days?.find(
                    d => d.work_date === format(date, 'yyyy-MM-dd')
                  );

                  return (
                    <div
                      key={assignment.id}
                      className={`p-2 rounded text-xs ${
                        BOOKING_STATUS_CONFIG[assignment.booking_status].bgColor
                      } ${
                        BOOKING_STATUS_CONFIG[assignment.booking_status].borderColor
                      } border`}
                    >
                      <div className="font-medium truncate">
                        {assignment.project?.client_name}
                      </div>
                      {dayData && (
                        <div className="text-muted-foreground">
                          {dayData.start_time.slice(0, 5)} - {dayData.end_time.slice(0, 5)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Tasks:**
- [ ] Create `/engineer/schedule/page.tsx`
- [ ] Create `EngineerScheduleView` component
- [ ] Add toggle for tentative bookings
- [ ] Make mobile responsive (single column on mobile)
- [ ] Add to sidebar navigation for non-admin users

---

## Phase 4: Email Templates

### 4.1 Confirmation Email Template

**File:** `src/lib/email/templates.ts` - Add

```typescript
interface ConfirmationEmailParams {
  customerName: string;
  projectName: string;
  assignments: Array<{
    engineerName: string;
    days: Array<{
      date: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  confirmUrl: string;
  expiresAt: string;
}

export function confirmationEmailTemplate(params: ConfirmationEmailParams): string {
  const { customerName, projectName, assignments, confirmUrl, expiresAt } = params;

  // Format dates table
  const datesHtml = assignments.flatMap(a =>
    a.days.map(d => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${format(new Date(d.date), 'EEEE, MMMM d, yyyy')}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${d.startTime.slice(0, 5)} - ${d.endTime.slice(0, 5)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${escapeHtml(a.engineerName)}
        </td>
      </tr>
    `)
  ).join('');

  return baseTemplate(`
    <h1 style="color: #023A2D; margin-bottom: 24px;">
      Please Confirm Your Project Dates
    </h1>

    <p style="color: #6b7280; margin-bottom: 24px;">
      Hi ${escapeHtml(customerName)},
    </p>

    <p style="color: #6b7280; margin-bottom: 24px;">
      We've scheduled the following dates for <strong>${escapeHtml(projectName)}</strong>.
      Please review and confirm at your earliest convenience.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f9fafb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #023A2D; color: white;">
          <th style="padding: 12px; text-align: left;">Date</th>
          <th style="padding: 12px; text-align: left;">Time</th>
          <th style="padding: 12px; text-align: left;">Engineer</th>
        </tr>
      </thead>
      <tbody>
        ${datesHtml}
      </tbody>
    </table>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${confirmUrl}" style="
        display: inline-block;
        background: #023A2D;
        color: white;
        padding: 16px 32px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
      ">
        Review & Confirm Dates
      </a>
    </div>

    <p style="color: #9ca3af; font-size: 14px; text-align: center;">
      This link will expire on ${format(new Date(expiresAt), 'MMMM d, yyyy')}.
    </p>
  `);
}
```

**Tasks:**
- [ ] Add `confirmationEmailTemplate` function
- [ ] Add `pmNotificationEmailTemplate` (when customer responds)
- [ ] Test email rendering

---

## Phase 5: Integration & Polish

### 5.1 Update Sidebar Navigation

**File:** `src/components/layout/sidebar.tsx` - Updates

Add "My Schedule" link for engineers:

```typescript
// Add to navigation items based on role
const getNavigationItems = (role: string) => {
  const items = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/projects', label: 'Projects', icon: FolderOpen },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
  ];

  // Add engineer schedule for non-admin users
  if (role !== 'admin') {
    items.push({
      href: '/engineer/schedule',
      label: 'My Schedule',
      icon: CalendarDays
    });
  }

  // Admin-only items
  if (role === 'admin') {
    items.push({ href: '/admin', label: 'Admin', icon: Settings });
  }

  return items;
};
```

**Tasks:**
- [ ] Add conditional "My Schedule" nav item
- [ ] Update navigation based on user role

---

### 5.2 Add Context Menu to Assignment Cards

**File:** `src/components/calendar/assignment-card.tsx` - Updates

Add "Send to Customer" option in dropdown:

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
      <Pencil className="mr-2 h-4 w-4" />
      Edit Times
    </DropdownMenuItem>

    {/* New: Send to Customer */}
    {assignment.booking_status === 'tentative' && (
      <DropdownMenuItem onClick={() => setSendConfirmationOpen(true)}>
        <Send className="mr-2 h-4 w-4" />
        Send to Customer
      </DropdownMenuItem>
    )}

    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-destructive"
      onClick={() => handleRemove()}
    >
      <Trash className="mr-2 h-4 w-4" />
      Remove
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Tasks:**
- [ ] Add "Send to Customer" menu item
- [ ] Only show for `tentative` status
- [ ] Open `SendConfirmationDialog`

---

### 5.3 Update Middleware for New Routes

**File:** `src/middleware.ts` - Updates

```typescript
// Add confirmation page to public routes
const publicRoutes = [
  '/login',
  '/status/:token',
  '/confirm/:token', // New: customer confirmation
];

// Add engineer schedule to staff routes
const staffRoutes = [
  '/projects',
  '/admin',
  '/calendar',
  '/engineer/schedule', // New: engineer view
  '/',
];
```

**Tasks:**
- [ ] Add `/confirm/[token]` to public routes
- [ ] Add `/engineer/schedule` to staff routes

---

## Implementation Order

### Week 1: Database & Types
1. Create migration 017 (booking status update)
2. Create migration 018 (confirmation requests)
3. Run migrations locally
4. Update TypeScript types
5. Update constants and validation schemas

### Week 2: Backend Actions
1. Create confirmation-actions.ts
2. Update existing calendar actions
3. Add bulk status update
4. Update React Query hooks
5. Add email template

### Week 3: Frontend - PM Features
1. Update BookingStatusBadge colors
2. Create SendConfirmationDialog
3. Create BulkStatusToolbar
4. Add selection state to calendar views
5. Update assignment card context menu

### Week 4: Frontend - Customer & Engineer
1. Create customer confirmation page
2. Create engineer schedule page
3. Update sidebar navigation
4. Update middleware
5. Testing & polish

---

## Testing Checklist

### Migrations
- [ ] Migration 017 runs without errors
- [ ] Existing `pencil` data migrated to `tentative`
- [ ] Migration 018 runs without errors
- [ ] RLS policies work correctly

### Booking Statuses
- [ ] All 5 statuses display correctly
- [ ] Colors match spec
- [ ] Status cycling works (skips pending_confirm)
- [ ] Drafts hidden from non-admins

### Confirmation Flow
- [ ] PM can send confirmation from tentative assignments
- [ ] Email sends successfully
- [ ] Magic link works
- [ ] Customer can confirm
- [ ] Customer can decline with reason
- [ ] Status updates after response
- [ ] PM receives notification (toast)
- [ ] Expired links handled

### Engineer View
- [ ] Page loads for all users
- [ ] Only non-draft assignments shown
- [ ] Toggle tentative works
- [ ] Mobile responsive

### Bulk Operations
- [ ] Can select multiple assignments
- [ ] Bulk status change works
- [ ] History recorded for each
