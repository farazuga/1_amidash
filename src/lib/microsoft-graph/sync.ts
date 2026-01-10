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

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.amidash.com';
}

/**
 * Get all active calendar connections for a user
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

  return data || [];
}

/**
 * Get existing synced event mapping
 */
async function getSyncedEvent(
  assignmentId: string,
  connectionId: string
): Promise<{ id: string; external_event_id: string } | null> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select('id, external_event_id')
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
 */
async function updateSyncError(
  assignmentId: string,
  connectionId: string,
  error: string
): Promise<void> {
  const supabase = await createServiceClient();

  // Try to update existing record, or insert new one with error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      connection_id: connectionId,
      external_event_id: '',
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
 * Sync a single assignment to Outlook
 */
export async function syncAssignmentToOutlook(
  assignment: AssignmentForSync,
  connection: CalendarConnection
): Promise<SyncResult> {
  try {
    const baseUrl = getBaseUrl();
    const event = buildEventFromAssignment(assignment, baseUrl);

    // Check if we already have a synced event
    const existingSync = await getSyncedEvent(assignment.id, connection.id);

    if (existingSync) {
      // Update existing event
      await updateCalendarEvent(connection, existingSync.external_event_id, event);
      await storeSyncedEvent(assignment.id, connection.id, existingSync.external_event_id);

      return { success: true, eventId: existingSync.external_event_id };
    } else {
      // Create new event
      const response = await createCalendarEvent(connection, event);
      await storeSyncedEvent(assignment.id, connection.id, response.id);

      return { success: true, eventId: response.id };
    }
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

  // Get user's assignments with project data
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
        end_date
      )
    `)
    .eq('user_id', userId)
    .not('project.start_date', 'is', null)
    .not('project.end_date', 'is', null);

  if (error) {
    console.error('Failed to fetch assignments:', error);
    return { synced: 0, failed: 0, errors: ['Failed to fetch assignments'] };
  }

  if (!assignments || assignments.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  // Build all sync tasks
  const syncTasks = connections.flatMap((connection) =>
    assignments.map((assignment) => ({
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
            },
          },
          connection
        ),
    }))
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
 * Trigger sync for a specific assignment across all of the user's connections
 * Called from assignment actions
 */
export async function triggerAssignmentSync(
  assignment: AssignmentForSync
): Promise<void> {
  const connections = await getActiveConnections(assignment.user_id);

  // Sync to all connections in parallel
  await Promise.allSettled(
    connections.map((connection) => syncAssignmentToOutlook(assignment, connection))
  );
}

/**
 * Trigger delete for a specific assignment across all of the user's connections
 * Called from assignment actions when removing
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
 */
export async function retrySyncForAssignment(
  assignmentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

  // Get assignment with project data
  const { data: assignment, error: fetchError } = await supabase
    .from('project_assignments')
    .select(`
      id, user_id, project_id, booking_status, notes,
      project:projects(id, client_name, start_date, end_date)
    `)
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    return { success: false, error: 'Assignment not found' };
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
