/**
 * Sync logic for pushing assignments to Outlook Calendar
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  buildEventFromAssignment,
} from './client';
import type { CalendarConnection, SyncResult, AssignmentForSync } from './types';
import { SYNCABLE_STATUSES } from './types';

// Constants for slot reservation (race condition prevention)
const PENDING_SLOT_MARKER = '__pending__';
const PENDING_SLOT_TIMEOUT_MS = 30000; // 30 seconds - slots older than this are considered stale
const MAX_SLOT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.amidash.com';
}

/**
 * Check if a pending slot is stale (older than timeout)
 */
function isSlotStale(lastSyncedAt: string): boolean {
  const slotAge = Date.now() - new Date(lastSyncedAt).getTime();
  return slotAge > PENDING_SLOT_TIMEOUT_MS;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get all active calendar connections for a user
 * Includes explicit user validation as security safeguard
 */
export async function getActiveConnections(userId: string): Promise<CalendarConnection[]> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'microsoft');

  if (error) {
    console.error('Failed to fetch calendar connections:', error);
    return [];
  }

  const connections = data || [];

  // Security validation: Ensure all returned connections belong to the expected user
  // This is a safeguard since we use service client which bypasses RLS
  const validConnections = connections.filter((conn: CalendarConnection) => conn.user_id === userId);

  if (validConnections.length !== connections.length) {
    console.error('Security: Calendar connection user_id mismatch detected - filtered out invalid connections');
  }

  return validConnections;
}

/**
 * Get existing synced event mapping with timestamp for stale detection
 */
async function getSyncedEvent(
  assignmentId: string,
  connectionId: string
): Promise<{ id: string; external_event_id: string; last_synced_at: string } | null> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select('id, external_event_id, last_synced_at')
    .eq('assignment_id', assignmentId)
    .eq('connection_id', connectionId)
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
  connectionId: string,
  externalEventId: string
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      connection_id: connectionId,
      external_event_id: externalEventId,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    },
    {
      onConflict: 'assignment_id,connection_id',
    }
  );

  if (error) {
    console.error('Failed to store synced event:', error);
  }
}

/**
 * Update sync error for an event
 * Preserves existing external_event_id if one exists to allow cleanup of orphaned events
 */
async function updateSyncError(
  assignmentId: string,
  connectionId: string,
  error: string
): Promise<void> {
  const supabase = await createServiceClient();

  // First check if we have an existing record with an external_event_id
  const existing = await getSyncedEvent(assignmentId, connectionId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      connection_id: connectionId,
      // Preserve existing external_event_id if present, otherwise use empty string
      external_event_id: existing?.external_event_id || '',
      last_synced_at: new Date().toISOString(),
      sync_error: error,
    },
    {
      onConflict: 'assignment_id,connection_id',
    }
  );
}

/**
 * Delete synced event mapping
 */
async function deleteSyncedEvent(
  assignmentId: string,
  connectionId: string
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('synced_calendar_events')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('connection_id', connectionId);
}

/**
 * Reserve a sync slot to prevent race conditions
 * Handles stale slots (pending for > 30 seconds) by cleaning them up
 * Returns the existing external_event_id if slot was already taken, null if we created it
 */
async function reserveSyncSlot(
  assignmentId: string,
  connectionId: string
): Promise<{ isNew: boolean; existingEventId: string | null; isPending: boolean }> {
  const supabase = await createServiceClient();

  // First, check if there's an existing record
  const existing = await getSyncedEvent(assignmentId, connectionId);

  if (existing) {
    // If it's a completed slot (has real event ID), return it
    if (existing.external_event_id && existing.external_event_id !== PENDING_SLOT_MARKER) {
      return { isNew: false, existingEventId: existing.external_event_id, isPending: false };
    }

    // If it's a pending slot, check if it's stale
    if (existing.external_event_id === PENDING_SLOT_MARKER) {
      if (isSlotStale(existing.last_synced_at)) {
        // Stale pending slot - delete it and try to reserve
        console.log('Cleaning up stale pending slot for assignment:', assignmentId);
        await deleteSyncedEvent(assignmentId, connectionId);
        // Fall through to try inserting a new slot
      } else {
        // Active pending slot - another process is working on it
        return { isNew: false, existingEventId: null, isPending: true };
      }
    }
  }

  // Try to insert a placeholder record - if it conflicts, someone else just took the slot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('synced_calendar_events')
    .insert({
      assignment_id: assignmentId,
      connection_id: connectionId,
      external_event_id: PENDING_SLOT_MARKER,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    });

  if (!insertError) {
    // We successfully reserved the slot
    return { isNew: true, existingEventId: null, isPending: false };
  }

  // Insert failed due to race condition - re-check the existing record
  const recheckExisting = await getSyncedEvent(assignmentId, connectionId);
  if (recheckExisting?.external_event_id && recheckExisting.external_event_id !== PENDING_SLOT_MARKER) {
    return { isNew: false, existingEventId: recheckExisting.external_event_id, isPending: false };
  }

  // Another process just reserved it
  return { isNew: false, existingEventId: null, isPending: true };
}

/**
 * Sync a single assignment to Outlook
 * Uses slot reservation with retry loop to prevent race conditions and duplicate events
 *
 * @param assignment - The assignment data to sync
 * @param connection - The user's calendar connection
 * @returns SyncResult with success status and event ID or error
 */
export async function syncAssignmentToOutlook(
  assignment: AssignmentForSync,
  connection: CalendarConnection
): Promise<SyncResult> {
  try {
    const baseUrl = getBaseUrl();
    const event = buildEventFromAssignment(assignment, baseUrl);

    // Retry loop with exponential backoff for handling concurrent syncs
    for (let attempt = 0; attempt < MAX_SLOT_RETRIES; attempt++) {
      const { isNew, existingEventId, isPending } = await reserveSyncSlot(assignment.id, connection.id);

      if (!isNew && existingEventId) {
        // Update existing event
        await updateCalendarEvent(connection, existingEventId, event);
        await storeSyncedEvent(assignment.id, connection.id, existingEventId);
        return { success: true, eventId: existingEventId };
      }

      if (isPending) {
        // Another process is creating the event - wait with exponential backoff and retry
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
        console.log(`Slot pending, waiting ${delay}ms before retry ${attempt + 1}/${MAX_SLOT_RETRIES}`);
        await sleep(delay);

        // After waiting, check if the other process completed
        const existing = await getSyncedEvent(assignment.id, connection.id);
        if (existing?.external_event_id && existing.external_event_id !== PENDING_SLOT_MARKER) {
          // Other process finished, update the event
          await updateCalendarEvent(connection, existing.external_event_id, event);
          return { success: true, eventId: existing.external_event_id };
        }
        // Still pending - continue to next retry iteration
        continue;
      }

      if (isNew) {
        // We reserved the slot - create new event
        const response = await createCalendarEvent(connection, event);
        await storeSyncedEvent(assignment.id, connection.id, response.id);
        return { success: true, eventId: response.id };
      }
    }

    // All retries exhausted - this shouldn't normally happen
    throw new Error('Failed to acquire sync slot after maximum retries');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to sync assignment to Outlook:', errorMessage);
    await updateSyncError(assignment.id, connection.id, errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Delete an assignment from Outlook
 */
export async function deleteAssignmentFromOutlook(
  assignmentId: string,
  connection: CalendarConnection
): Promise<SyncResult> {
  try {
    const existingSync = await getSyncedEvent(assignmentId, connection.id);

    if (existingSync && existingSync.external_event_id) {
      await deleteCalendarEvent(connection, existingSync.external_event_id);
    }

    await deleteSyncedEvent(assignmentId, connection.id);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to delete assignment from Outlook:', errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync all assignments for a user to their connected calendars
 * Used for initial sync when connecting or manual "Sync Now"
 * Fetches team members for enriched event body
 */
export async function fullSyncForUser(userId: string): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createServiceClient();

  // Get user's calendar connections
  const connections = await getActiveConnections(userId);
  if (connections.length === 0) {
    return { synced: 0, failed: 0, errors: ['No calendar connections found'] };
  }

  // Get user's assignments with extended project data
  // Only sync pending_confirm and confirmed statuses
  const { data: assignments, error } = await supabase
    .from('project_assignments')
    .select(`
      id,
      user_id,
      project_id,
      booking_status,
      notes,
      project:projects!inner(
        id,
        client_name,
        start_date,
        end_date,
        sales_order_number,
        poc_name,
        poc_email,
        poc_phone,
        scope_link,
        sales_order_url
      )
    `)
    .eq('user_id', userId)
    .in('booking_status', [...SYNCABLE_STATUSES])
    .not('project.start_date', 'is', null)
    .not('project.end_date', 'is', null);

  if (error) {
    console.error('Failed to fetch assignments:', error);
    return { synced: 0, failed: 0, errors: ['Failed to fetch assignments'] };
  }

  if (!assignments || assignments.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  // Get unique project IDs
  const projectIds = [...new Set(assignments.map((a) => a.project_id))];

  // Fetch team members for all projects in one query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allProjectMembers, error: membersError } = await (supabase as any)
    .from('project_assignments')
    .select('project_id, user_id, booking_status, profile:profiles(full_name)')
    .in('project_id', projectIds);

  if (membersError) {
    console.warn('Failed to fetch team members for enriched event body:', membersError);
    // Continue without team members rather than failing entire sync
  }

  // Build team members map: projectId -> array of team members
  const teamMembersMap = new Map<string, Array<{ user_id: string; full_name: string; booking_status: string }>>();
  if (allProjectMembers) {
    for (const member of allProjectMembers) {
      const projectId = member.project_id;
      if (!teamMembersMap.has(projectId)) {
        teamMembersMap.set(projectId, []);
      }
      teamMembersMap.get(projectId)!.push({
        user_id: member.user_id,
        full_name: member.profile?.full_name || 'Unknown',
        booking_status: member.booking_status,
      });
    }
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  // Build all sync tasks with extended project data and team members
  const syncTasks = connections.flatMap((connection) =>
    assignments.map((assignment) => {
      // Get team members for this project, excluding the current user
      const projectTeam = teamMembersMap.get(assignment.project_id) || [];
      const teamMembers = projectTeam
        .filter((m) => m.user_id !== userId)
        .map(({ full_name, booking_status }) => ({ full_name, booking_status }));

      return {
        connection,
        assignment,
        execute: () =>
          syncAssignmentToOutlook(
            {
              id: assignment.id,
              user_id: assignment.user_id,
              project_id: assignment.project_id,
              booking_status: assignment.booking_status,
              notes: assignment.notes,
              project: {
                id: assignment.project.id,
                client_name: assignment.project.client_name,
                start_date: assignment.project.start_date!,
                end_date: assignment.project.end_date!,
                sales_order: assignment.project.sales_order_number,
                poc_name: assignment.project.poc_name,
                poc_email: assignment.project.poc_email,
                poc_phone: assignment.project.poc_phone,
                scope_link: assignment.project.scope_link,
                sales_order_url: assignment.project.sales_order_url,
              },
              team_members: teamMembers,
            },
            connection
          ),
      };
    })
  );

  // Process in batches with concurrency limit to avoid overwhelming the API
  const CONCURRENCY_LIMIT = 5;
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
          errors.push(`${task.assignment.project.client_name}: ${errorMsg}`);
        }
      }
    });
  }

  return { synced, failed, errors };
}

/**
 * Trigger sync for a specific assignment across all of the user's connections.
 * This is the main entry point for syncing a single assignment to Outlook.
 *
 * Behavior by status:
 * - pending_confirm/confirmed: Creates or updates the Outlook event
 * - draft/tentative: Deletes the Outlook event if it exists
 *
 * @param assignment - The assignment data including project details and team members
 * @returns Promise that resolves when sync is complete (fire-and-forget safe)
 */
export async function triggerAssignmentSync(
  assignment: AssignmentForSync
): Promise<void> {
  const connections = await getActiveConnections(assignment.user_id);

  // Check if this status should be synced
  if (!SYNCABLE_STATUSES.includes(assignment.booking_status as typeof SYNCABLE_STATUSES[number])) {
    // Status is draft or tentative - delete from Outlook if exists
    await Promise.allSettled(
      connections.map((connection) => deleteAssignmentFromOutlook(assignment.id, connection))
    );
    return;
  }

  // Sync to all connections in parallel
  await Promise.allSettled(
    connections.map((connection) => syncAssignmentToOutlook(assignment, connection))
  );
}

/**
 * Trigger deletion of a calendar event for an assignment across all user's connections.
 * Called when an assignment is removed from a project.
 *
 * @param assignmentId - The ID of the assignment being removed
 * @param userId - The user ID whose calendar connections should be updated
 * @returns Promise that resolves when deletion is complete (fire-and-forget safe)
 */
export async function triggerAssignmentDelete(
  assignmentId: string,
  userId: string
): Promise<void> {
  const connections = await getActiveConnections(userId);

  // Delete from all connections in parallel
  await Promise.allSettled(
    connections.map((connection) => deleteAssignmentFromOutlook(assignmentId, connection))
  );
}

/**
 * Sync all assignments for a project to Outlook
 * Called when project dates or other synced fields change
 * Fetches team members for enriched event body
 *
 * @param projectId - The project ID to sync assignments for
 */
export async function syncProjectAssignmentsToOutlook(projectId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Fetch project with all relevant fields
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_name, start_date, end_date, sales_order_number, poc_name, poc_email, poc_phone, scope_link, sales_order_url')
    .eq('id', projectId)
    .single();

  if (projectError) {
    console.error('Failed to fetch project for Outlook sync:', projectError);
    return;
  }

  if (!project?.start_date || !project?.end_date) {
    console.log('Skipping Outlook sync: project missing start or end dates');
    return;
  }

  // Fetch all assignments for this project with user profile info
  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select(`
      id, user_id, project_id, booking_status, notes,
      profile:profiles(full_name)
    `)
    .eq('project_id', projectId);

  if (assignmentsError) {
    console.error('Failed to fetch assignments for Outlook sync:', assignmentsError);
    return;
  }

  if (!assignments || assignments.length === 0) {
    return;
  }

  // Build team members list for enriched event body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTeamMembers = assignments.map((a: any) => ({
    user_id: a.user_id,
    full_name: a.profile?.full_name || 'Unknown',
    booking_status: a.booking_status,
  }));

  // Sync each assignment with team members (excluding self)
  for (const assignment of assignments) {
    const teamMembers = allTeamMembers
      .filter((m) => m.user_id !== assignment.user_id)
      .map(({ full_name, booking_status }) => ({ full_name, booking_status }));

    const assignmentForSync: AssignmentForSync = {
      id: assignment.id,
      user_id: assignment.user_id,
      project_id: assignment.project_id,
      booking_status: assignment.booking_status,
      notes: assignment.notes,
      project: {
        id: project.id,
        client_name: project.client_name,
        start_date: project.start_date,
        end_date: project.end_date,
        sales_order: project.sales_order_number,
        poc_name: project.poc_name,
        poc_email: project.poc_email,
        poc_phone: project.poc_phone,
        scope_link: project.scope_link,
        sales_order_url: project.sales_order_url,
      },
      team_members: teamMembers,
    };

    // Fire-and-forget async sync
    triggerAssignmentSync(assignmentForSync).catch((err) =>
      console.error('Outlook sync error for assignment:', assignment.id, err)
    );
  }
}

/**
 * Get recent sync errors for a user
 * Returns failed syncs from the last 7 days
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

  // Get connections for this user
  const connections = await getActiveConnections(userId);
  if (connections.length === 0) {
    return { errors: [], count: 0 };
  }

  const connectionIds = connections.map(c => c.id);

  // Get synced events with errors for this user's connections
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
    .in('connection_id', connectionIds)
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

/**
 * Retry sync for a specific assignment
 * Validates that the assignment belongs to the requesting user for security
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
      id, user_id, project_id, booking_status, notes,
      project:projects(id, client_name, start_date, end_date)
    `)
    .eq('id', assignmentId)
    .eq('user_id', userId) // Security: ensure assignment belongs to this user
    .single();

  if (fetchError || !assignment) {
    return { success: false, error: 'Assignment not found or access denied' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = (assignment as any).project as { id: string; client_name: string; start_date: string | null; end_date: string | null } | null;
  if (!project?.start_date || !project?.end_date) {
    return { success: false, error: 'Project missing dates' };
  }

  // Get user's connections
  const connections = await getActiveConnections(userId);
  if (connections.length === 0) {
    return { success: false, error: 'No calendar connections found' };
  }

  // Try to sync to all connections
  const results = await Promise.allSettled(
    connections.map((connection) =>
      syncAssignmentToOutlook(
        {
          id: assignment.id,
          user_id: assignment.user_id,
          project_id: assignment.project_id,
          booking_status: assignment.booking_status,
          notes: assignment.notes,
          project: {
            id: project.id,
            client_name: project.client_name,
            start_date: project.start_date!, // Already validated above
            end_date: project.end_date!,     // Already validated above
          },
        },
        connection
      )
    )
  );

  // Check if any succeeded
  const anySuccess = results.some(
    (r) => r.status === 'fulfilled' && r.value.success
  );

  if (anySuccess) {
    return { success: true };
  }

  // Get first error
  const firstError = results.find(
    (r) => r.status === 'fulfilled' && !r.value.success
  );
  const errorMessage =
    firstError?.status === 'fulfilled' && firstError.value.error
      ? firstError.value.error
      : 'Sync failed';

  return { success: false, error: errorMessage };
}
