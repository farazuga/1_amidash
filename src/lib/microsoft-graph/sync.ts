/**
 * Sync logic for pushing assignments to Outlook Calendar
 * Uses app-level client credentials (no per-user OAuth tokens)
 * Creates per-day events on a dedicated "AmiDash" calendar for each engineer
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  createCalendarForUser,
  getCalendarForUser,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  buildCalendarEvent,
} from './client';
import type { SyncResult } from './types';
import { SYNCABLE_STATUSES } from './types';

// Constants
const PENDING_SLOT_MARKER = '__pending__';
const CONCURRENCY_LIMIT = 5;

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.amidash.com';
}


// ============================================
// Database helpers
// ============================================

/**
 * Get the engineer's Outlook email from the profiles table
 */
async function getEngineerEmail(userId: string): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to get engineer email:', error);
    return null;
  }

  return data.email;
}

/**
 * Get existing synced event mapping with timestamp for stale detection
 */
async function getSyncedEvent(
  assignmentId: string,
  userId: string,
  workDate: string
): Promise<{ id: string; external_event_id: string; last_synced_at: string } | null> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select('id, external_event_id, last_synced_at')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Store synced event mapping
 */
async function storeSyncedEvent(
  assignmentId: string,
  userId: string,
  workDate: string,
  externalEventId: string
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      user_id: userId,
      work_date: workDate,
      external_event_id: externalEventId,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    },
    {
      onConflict: 'assignment_id,user_id,work_date',
    }
  );

  if (error) {
    console.error('Failed to store synced event:', error);
  }
}

/**
 * Update sync error for an event
 */
async function updateSyncError(
  assignmentId: string,
  userId: string,
  workDate: string,
  errorMsg: string
): Promise<void> {
  const supabase = await createServiceClient();

  const existing = await getSyncedEvent(assignmentId, userId, workDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      user_id: userId,
      work_date: workDate,
      external_event_id: existing?.external_event_id || '',
      last_synced_at: new Date().toISOString(),
      sync_error: errorMsg,
    },
    {
      onConflict: 'assignment_id,user_id,work_date',
    }
  );
}

/**
 * Delete synced event mapping
 */
async function deleteSyncedEvent(
  assignmentId: string,
  userId: string,
  workDate: string
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('synced_calendar_events')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('work_date', workDate);
}

/**
 * Check if an existing Outlook event exists for this assignment+user+date.
 * Returns the external event ID if found, null otherwise.
 */
async function getExistingEventId(
  assignmentId: string,
  userId: string,
  workDate: string
): Promise<string | null> {
  const existing = await getSyncedEvent(assignmentId, userId, workDate);
  if (existing?.external_event_id && existing.external_event_id !== PENDING_SLOT_MARKER) {
    return existing.external_event_id;
  }
  // Clean up any stale pending markers
  if (existing?.external_event_id === PENDING_SLOT_MARKER) {
    await deleteSyncedEvent(assignmentId, userId, workDate);
  }
  return null;
}

// ============================================
// Calendar management
// ============================================

/**
 * Ensure the engineer has an "AmiDash" calendar in Outlook.
 * - Checks engineer_outlook_calendars table for existing record
 * - Verifies the calendar still exists in Outlook via Graph API
 * - Creates a new one if missing or deleted
 * Returns the Outlook calendar ID.
 */
export async function ensureAmiDashCalendar(
  userId: string,
  email: string
): Promise<string> {
  const supabase = await createServiceClient();

  // Check DB for existing calendar record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('engineer_outlook_calendars')
    .select('id, outlook_calendar_id, outlook_email')
    .eq('user_id', userId)
    .single();

  if (existing?.outlook_calendar_id) {
    // Verify the calendar still exists in Outlook
    const cal = await getCalendarForUser(email, existing.outlook_calendar_id);
    if (cal) {
      return existing.outlook_calendar_id;
    }
    // Calendar was deleted in Outlook - remove stale DB record
    console.log('AmiDash calendar deleted from Outlook, recreating for user:', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('engineer_outlook_calendars')
      .delete()
      .eq('id', existing.id);
  }

  // Create a new AmiDash calendar
  const newCal = await createCalendarForUser(email);

  // Store in DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('engineer_outlook_calendars')
    .upsert(
      {
        user_id: userId,
        outlook_calendar_id: newCal.id,
        outlook_email: email,
      },
      { onConflict: 'user_id' }
    );

  if (insertError) {
    console.error('Failed to store engineer outlook calendar:', insertError);
  }

  return newCal.id;
}

// ============================================
// Single day sync
// ============================================

/**
 * Sync a single assignment day to Outlook.
 * Uses slot reservation with retry loop to prevent race conditions.
 */
async function syncDayToOutlook(params: {
  assignmentId: string;
  userId: string;
  email: string;
  calendarId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  projectName: string;
  teamMembers: string[];
  pmContact?: string;
}): Promise<SyncResult> {
  const { assignmentId, userId, email, calendarId, workDate, startTime, endTime } = params;

  try {
    const baseUrl = getBaseUrl();
    const event = buildCalendarEvent({
      projectName: params.projectName,
      date: workDate,
      startTime,
      endTime,
      teamMembers: params.teamMembers,
      pmContact: params.pmContact,
      dashboardUrl: baseUrl,
    });

    // Check for existing synced event
    const existingEventId = await getExistingEventId(assignmentId, userId, workDate);

    if (existingEventId) {
      // Update existing Outlook event
      await updateCalendarEvent(email, calendarId, existingEventId, event);
      await storeSyncedEvent(assignmentId, userId, workDate, existingEventId);
      return { success: true, eventId: existingEventId };
    }

    // Create new Outlook event
    const response = await createCalendarEvent(email, calendarId, event);
    await storeSyncedEvent(assignmentId, userId, workDate, response.id);
    return { success: true, eventId: response.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to sync day to Outlook:', workDate, errorMessage);
    await updateSyncError(assignmentId, userId, workDate, errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Public API
// ============================================

/**
 * Main entry point: sync an assignment to Outlook.
 *
 * - Only syncs if status is confirmed (in SYNCABLE_STATUSES)
 * - If not confirmed, deletes any existing Outlook events for this assignment
 * - Fetches assignment_days and creates one Outlook event per day
 * - Fire-and-forget safe
 */
export async function triggerAssignmentSync(assignment: {
  id: string;
  user_id: string;
  booking_status: string;
  project_id: string;
  project_name: string;
}): Promise<void> {
  const { id: assignmentId, user_id: userId, booking_status } = assignment;

  // If not a syncable status, delete any existing events
  if (!SYNCABLE_STATUSES.includes(booking_status as (typeof SYNCABLE_STATUSES)[number])) {
    await deleteAssignmentFromOutlook(assignmentId, userId);
    return;
  }

  // Get engineer's email
  const email = await getEngineerEmail(userId);
  if (!email) {
    console.error('Cannot sync: no email found for user', userId);
    return;
  }

  // Ensure AmiDash calendar exists
  let calendarId: string;
  try {
    calendarId = await ensureAmiDashCalendar(userId, email);
  } catch (err) {
    console.error('Failed to ensure AmiDash calendar for user:', userId, err);
    return;
  }

  // Fetch assignment_days for this assignment
  const supabase = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: days, error: daysError } = await (supabase as any)
    .from('assignment_days')
    .select('work_date, start_time, end_time')
    .eq('assignment_id', assignmentId)
    .order('work_date', { ascending: true });

  if (daysError) {
    console.error('Failed to fetch assignment days for sync:', daysError);
    return;
  }

  if (!days || days.length === 0) {
    return;
  }

  // Fetch team members for this project (excluding current user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teamData } = await (supabase as any)
    .from('project_assignments')
    .select('user_id, profile:profiles(full_name)')
    .eq('project_id', assignment.project_id)
    .neq('user_id', userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMembers = (teamData || []).map((m: any) => m.profile?.full_name || 'Unknown');

  // Get current synced events for this assignment to detect orphaned days
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingSynced } = await (supabase as any)
    .from('synced_calendar_events')
    .select('work_date, external_event_id')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId);

  const currentDates = new Set(days.map((d: { work_date: string }) => d.work_date));
  const orphanedEvents = (existingSynced || []).filter(
    (e: { work_date: string }) => !currentDates.has(e.work_date)
  );

  // Delete orphaned events (days that were removed from the assignment)
  for (const orphan of orphanedEvents) {
    if (orphan.external_event_id && orphan.external_event_id !== PENDING_SLOT_MARKER) {
      try {
        await deleteCalendarEvent(email, calendarId, orphan.external_event_id);
      } catch (err) {
        console.error('Failed to delete orphaned event:', orphan.work_date, err);
      }
    }
    await deleteSyncedEvent(assignmentId, userId, orphan.work_date);
  }

  // Sync each day in batches
  const syncTasks = days.map((day: { work_date: string; start_time: string; end_time: string }) => ({
    execute: () =>
      syncDayToOutlook({
        assignmentId,
        userId,
        email,
        calendarId,
        workDate: day.work_date,
        startTime: day.start_time.slice(0, 5), // "08:00:00" -> "08:00"
        endTime: day.end_time.slice(0, 5),
        projectName: assignment.project_name,
        teamMembers,
      }),
  }));

  for (let i = 0; i < syncTasks.length; i += CONCURRENCY_LIMIT) {
    const batch = syncTasks.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.allSettled(batch.map((task: { execute: () => Promise<SyncResult> }) => task.execute()));
  }
}

/**
 * Delete all Outlook events for an assignment+user.
 * Called when assignment is removed or status changes to non-syncable.
 */
export async function deleteAssignmentFromOutlook(
  assignmentId: string,
  userId: string
): Promise<void> {
  const supabase = await createServiceClient();

  // Look up all synced events for this assignment+user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: syncedEvents, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select('id, work_date, external_event_id')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId);

  if (error || !syncedEvents || syncedEvents.length === 0) {
    return;
  }

  // Get engineer's email and calendar ID for deletion
  const email = await getEngineerEmail(userId);
  if (!email) {
    console.error('Cannot delete events: no email found for user', userId);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: calRecord } = await (supabase as any)
    .from('engineer_outlook_calendars')
    .select('outlook_calendar_id')
    .eq('user_id', userId)
    .single();

  const calendarId = calRecord?.outlook_calendar_id;

  // Delete each event from Outlook
  for (const event of syncedEvents) {
    if (event.external_event_id && event.external_event_id !== PENDING_SLOT_MARKER && calendarId) {
      try {
        await deleteCalendarEvent(email, calendarId, event.external_event_id);
      } catch (err) {
        console.error('Failed to delete Outlook event:', event.external_event_id, err);
      }
    }
  }

  // Remove all from synced_calendar_events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('synced_calendar_events')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId);
}

/**
 * Full sync for a user: sync all their confirmed assignments.
 * Used for manual "Sync Now" or initial sync.
 */
export async function fullSyncForUser(userId: string): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createServiceClient();

  // Get engineer's email
  const email = await getEngineerEmail(userId);
  if (!email) {
    return { synced: 0, failed: 0, errors: ['No email found for user'] };
  }

  // Ensure AmiDash calendar exists
  let calendarId: string;
  try {
    calendarId = await ensureAmiDashCalendar(userId, email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { synced: 0, failed: 0, errors: [`Failed to ensure calendar: ${msg}`] };
  }

  // Get all confirmed assignments with project data and assignment_days
  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select(`
      id,
      user_id,
      project_id,
      booking_status,
      project:projects!inner(
        id,
        client_name
      )
    `)
    .eq('user_id', userId)
    .in('booking_status', [...SYNCABLE_STATUSES]);

  if (assignmentsError) {
    console.error('Failed to fetch assignments for full sync:', assignmentsError);
    return { synced: 0, failed: 0, errors: ['Failed to fetch assignments'] };
  }

  if (!assignments || assignments.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  // Fetch all assignment_days for these assignments
  const assignmentIds = assignments.map((a) => a.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allDays, error: daysError } = await (supabase as any)
    .from('assignment_days')
    .select('assignment_id, work_date, start_time, end_time')
    .in('assignment_id', assignmentIds)
    .order('work_date', { ascending: true });

  if (daysError) {
    console.error('Failed to fetch assignment days for full sync:', daysError);
    return { synced: 0, failed: 0, errors: ['Failed to fetch assignment days'] };
  }

  // Group days by assignment_id
  const daysByAssignment = new Map<string, Array<{ work_date: string; start_time: string; end_time: string }>>();
  for (const day of allDays || []) {
    if (!daysByAssignment.has(day.assignment_id)) {
      daysByAssignment.set(day.assignment_id, []);
    }
    daysByAssignment.get(day.assignment_id)!.push(day);
  }

  // Fetch team members for all projects
  const projectIds = [...new Set(assignments.map((a) => a.project_id))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allTeamData } = await (supabase as any)
    .from('project_assignments')
    .select('project_id, user_id, profile:profiles(full_name)')
    .in('project_id', projectIds);

  const teamByProject = new Map<string, string[]>();
  for (const m of allTeamData || []) {
    if (!teamByProject.has(m.project_id)) {
      teamByProject.set(m.project_id, []);
    }
    if (m.user_id !== userId) {
      teamByProject.get(m.project_id)!.push(m.profile?.full_name || 'Unknown');
    }
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  // Build all sync tasks (one per day per assignment)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncTasks: Array<{ projectName: string; execute: () => Promise<SyncResult> }> = [];

  for (const assignment of assignments) {
    const days = daysByAssignment.get(assignment.id) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectName = (assignment as any).project?.client_name || 'Unknown';
    const teamMembers = teamByProject.get(assignment.project_id) || [];

    for (const day of days) {
      syncTasks.push({
        projectName,
        execute: () =>
          syncDayToOutlook({
            assignmentId: assignment.id,
            userId,
            email,
            calendarId,
            workDate: day.work_date,
            startTime: day.start_time.slice(0, 5),
            endTime: day.end_time.slice(0, 5),
            projectName,
            teamMembers,
          }),
      });
    }
  }

  // Process in batches
  for (let i = 0; i < syncTasks.length; i += CONCURRENCY_LIMIT) {
    const batch = syncTasks.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(batch.map((task) => task.execute()));

    results.forEach((result, index) => {
      const task = batch[index];
      if (result.status === 'fulfilled' && result.value.success) {
        synced++;
      } else {
        failed++;
        const errorMsg =
          result.status === 'fulfilled'
            ? result.value.error
            : result.reason?.message || 'Unknown error';
        if (errorMsg) {
          errors.push(`${task.projectName}: ${errorMsg}`);
        }
      }
    });
  }

  return { synced, failed, errors };
}

/**
 * Sync all assignments for a project to Outlook.
 * Called when project data changes (name, dates, etc.).
 * Triggers sync for each assigned user.
 */
export async function syncProjectAssignmentsToOutlook(projectId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Fetch project name
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_name')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error('Failed to fetch project for Outlook sync:', projectError);
    return;
  }

  // Fetch all assignments for this project
  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select('id, user_id, project_id, booking_status')
    .eq('project_id', projectId);

  if (assignmentsError) {
    console.error('Failed to fetch assignments for project sync:', assignmentsError);
    return;
  }

  if (!assignments || assignments.length === 0) {
    return;
  }

  // Fire-and-forget sync for each assignment
  for (const assignment of assignments) {
    triggerAssignmentSync({
      id: assignment.id,
      user_id: assignment.user_id,
      booking_status: assignment.booking_status,
      project_id: assignment.project_id,
      project_name: project.client_name,
    }).catch((err) =>
      console.error('Outlook sync error for assignment:', assignment.id, err)
    );
  }
}

/**
 * Alias for backward compatibility with callers using the old name.
 */
export const triggerAssignmentDelete = deleteAssignmentFromOutlook;

/**
 * Retry sync for a specific assignment.
 * Validates that the assignment belongs to the requesting user for security.
 */
export async function retrySyncForAssignment(
  assignmentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  // Get assignment with project data - MUST filter by user_id for security
  const { data: assignment, error: fetchError } = await supabase
    .from('project_assignments')
    .select(`
      id, user_id, project_id, booking_status,
      project:projects(client_name)
    `)
    .eq('id', assignmentId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !assignment) {
    return { success: false, error: 'Assignment not found or access denied' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = (assignment as any).project as { client_name: string } | null;

  try {
    await triggerAssignmentSync({
      id: assignment.id,
      user_id: assignment.user_id,
      booking_status: assignment.booking_status,
      project_id: assignment.project_id,
      project_name: project?.client_name || 'Unknown',
    });
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Sync failed';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get recent sync errors for a user.
 * Returns failed syncs from the synced_calendar_events table.
 */
export async function getSyncErrors(userId: string): Promise<{
  errors: Array<{
    id: string;
    assignmentId: string;
    projectName: string;
    error: string;
    lastSyncedAt: string;
  }>;
  count: number;
}> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select(`
      id,
      assignment_id,
      sync_error,
      last_synced_at,
      assignment:project_assignments(
        id,
        project:projects(client_name)
      )
    `)
    .eq('user_id', userId)
    .not('sync_error', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Failed to fetch sync errors:', error);
    return { errors: [], count: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = (data || []).map((item: any) => ({
    id: item.id,
    assignmentId: item.assignment_id,
    projectName: item.assignment?.project?.client_name || 'Unknown Project',
    error: item.sync_error,
    lastSyncedAt: item.last_synced_at,
  }));

  return { errors, count: errors.length };
}
