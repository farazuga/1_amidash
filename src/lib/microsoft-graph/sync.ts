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

  // Get user's assignments with extended project data
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
        sales_order_url,
        poc_name,
        poc_email,
        poc_phone,
        goal_completion_date
      )
    `)
    .eq('user_id', userId)
    .not('project.start_date', 'is', null)
    .not('project.end_date', 'is', null);

  // Get other engineers for each project
  const projectIds = [...new Set((assignments || []).map(a => a.project_id))];
  const otherEngineersMap: Record<string, string[]> = {};

  if (projectIds.length > 0) {
    const { data: allAssignments } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        user:profiles!user_id(full_name, email)
      `)
      .in('project_id', projectIds)
      .neq('user_id', userId);

    if (allAssignments) {
      for (const assignment of allAssignments) {
        if (!otherEngineersMap[assignment.project_id]) {
          otherEngineersMap[assignment.project_id] = [];
        }
        const user = assignment.user as { full_name: string | null; email: string } | null;
        if (user) {
          const name = user.full_name || user.email;
          if (!otherEngineersMap[assignment.project_id].includes(name)) {
            otherEngineersMap[assignment.project_id].push(name);
          }
        }
      }
    }
  }

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

  // Sync each assignment to each connection
  for (const connection of connections) {
    for (const assignment of assignments) {
      const project = assignment.project as {
        id: string;
        client_name: string;
        start_date: string;
        end_date: string;
        sales_order_number: string | null;
        sales_order_url: string | null;
        poc_name: string | null;
        poc_email: string | null;
        poc_phone: string | null;
        goal_completion_date: string | null;
      };

      const result = await syncAssignmentToOutlook(
        {
          id: assignment.id,
          user_id: assignment.user_id,
          project_id: assignment.project_id,
          booking_status: assignment.booking_status,
          notes: assignment.notes,
          project: {
            id: project.id,
            client_name: project.client_name,
            start_date: project.start_date!,
            end_date: project.end_date!,
            sales_order_number: project.sales_order_number,
            sales_order_url: project.sales_order_url,
            poc_name: project.poc_name,
            poc_email: project.poc_email,
            poc_phone: project.poc_phone,
            goal_completion_date: project.goal_completion_date,
          },
          other_engineers: otherEngineersMap[assignment.project_id] || [],
        },
        connection
      );

      if (result.success) {
        synced++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`${project.client_name}: ${result.error}`);
        }
      }
    }
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
