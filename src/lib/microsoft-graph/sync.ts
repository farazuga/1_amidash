/**
 * Sync logic for pushing assignments to Outlook Calendar
 * Uses app-level client credentials (no per-user OAuth tokens)
 * Creates per-day events on dedicated calendars for each engineer:
 *   - "AmiDash - {FirstName}" — personal assignments only
 *   - "AmiDash - Projects" — all project assignments across all engineers
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  createCalendarForUser,
  getCalendarForUser,
  updateCalendarForUser,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  buildCalendarEvent,
} from './client';
import type { SyncResult, OutlookEventInput } from './types';
import { SYNCABLE_STATUSES, PROJECTS_CALENDAR_STATUSES } from './types';

// Constants
const PENDING_SLOT_MARKER = '__pending__';
const CONCURRENCY_LIMIT = 5;
type CalendarType = 'personal' | 'projects';

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.amidash.com';
}

/**
 * Build Odoo sales order URL from project data
 */
function buildSalesOrderUrl(salesOrderUrl: string | null | undefined, odooOrderId: number | null | undefined): string | undefined {
  if (salesOrderUrl) return salesOrderUrl;
  const odooUrl = process.env.ODOO_URL;
  if (odooOrderId && odooUrl) {
    return `${odooUrl}/web#id=${odooOrderId}&model=sale.order&view_type=form`;
  }
  return undefined;
}

/**
 * Build location string from delivery address parts
 */
function buildLocation(project: { delivery_street?: string | null; delivery_city?: string | null; delivery_state?: string | null; delivery_zip?: string | null } | null): string | undefined {
  if (!project) return undefined;
  const parts = [project.delivery_street, project.delivery_city, project.delivery_state, project.delivery_zip].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}


// ============================================
// Date range helpers
// ============================================

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * Group sorted dates into contiguous weekday ranges.
 * A gap of more than 1 business day (skipping weekends) starts a new range.
 * E.g. Mon-Fri is one range, next Mon-Wed is a separate range.
 */
function groupDaysIntoRanges(sortedDates: string[]): DateRange[] {
  if (sortedDates.length === 0) return [];

  const ranges: DateRange[] = [];
  let rangeStart = sortedDates[0];
  let rangeEnd = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(rangeEnd + 'T00:00:00');
    const curr = new Date(sortedDates[i] + 'T00:00:00');

    // Calculate expected next business day from prev
    const nextBizDay = new Date(prev);
    nextBizDay.setDate(nextBizDay.getDate() + 1);
    // Skip weekends
    while (nextBizDay.getDay() === 0 || nextBizDay.getDay() === 6) {
      nextBizDay.setDate(nextBizDay.getDate() + 1);
    }

    if (curr.getTime() === nextBizDay.getTime()) {
      // Contiguous — extend range
      rangeEnd = sortedDates[i];
    } else {
      // Gap — close current range, start new one
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = sortedDates[i];
      rangeEnd = sortedDates[i];
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });
  return ranges;
}

/**
 * Build a multi-day Outlook event for a project date range on the "AmiDash - Projects" calendar.
 */
function buildProjectCalendarEvent(params: {
  projectName: string;
  projectId: string;
  range: DateRange;
  engineers: string[];
  location?: string;
  salesOrderUrl?: string;
  projectDescription?: string;
  bookingStatus?: string;
  dashboardUrl: string;
}): OutlookEventInput {
  const statusLabel = params.bookingStatus === 'pending' ? ' [Pending]' : '';
  const body = [
    `📋 Project: ${params.projectName}${statusLabel}`,
    params.projectDescription ? `\n${params.projectDescription}` : null,
    params.engineers.length > 0
      ? `\n👥 Engineers: ${params.engineers.join(', ')}`
      : null,
    `🔗 Dashboard: ${params.dashboardUrl}/projects/${params.projectId}`,
    params.salesOrderUrl ? `📦 Sales Order: ${params.salesOrderUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // For multi-day events, use all-day format with date-only values
  // Graph API expects the end date to be the day AFTER the last day for all-day events
  const endDate = new Date(params.range.end + 'T00:00:00');
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  const event: OutlookEventInput = {
    subject: `${params.projectName}${statusLabel}`,
    body: { contentType: 'text', content: body },
    start: {
      dateTime: params.range.start,
      timeZone: 'Eastern Standard Time',
    },
    end: {
      dateTime: endDateStr,
      timeZone: 'Eastern Standard Time',
    },
    isAllDay: true,
    showAs: 'free', // Don't block time on the projects calendar
    categories: params.bookingStatus === 'pending' ? ['Yellow category'] : ['Green category'],
    sensitivity: 'normal',
  };

  if (params.location) {
    event.location = { displayName: params.location };
  }

  return event;
}

// ============================================
// Database helpers
// ============================================

/**
 * Get the engineer's Outlook email and name from the profiles table
 */
async function getEngineerProfile(userId: string): Promise<{ email: string; fullName: string } | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to get engineer profile:', error);
    return null;
  }

  return { email: data.email, fullName: data.full_name || '' };
}

/**
 * Get existing synced event mapping with timestamp for stale detection
 */
async function getSyncedEvent(
  assignmentId: string,
  userId: string,
  workDate: string,
  calendarType: CalendarType = 'personal'
): Promise<{ id: string; external_event_id: string; last_synced_at: string } | null> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select('id, external_event_id, last_synced_at')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .eq('calendar_type', calendarType)
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
  externalEventId: string,
  calendarType: CalendarType = 'personal'
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      user_id: userId,
      work_date: workDate,
      external_event_id: externalEventId,
      calendar_type: calendarType,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
    },
    {
      onConflict: 'assignment_id,user_id,work_date,calendar_type',
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
  errorMsg: string,
  calendarType: CalendarType = 'personal'
): Promise<void> {
  const supabase = await createServiceClient();

  const existing = await getSyncedEvent(assignmentId, userId, workDate, calendarType);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('synced_calendar_events').upsert(
    {
      assignment_id: assignmentId,
      user_id: userId,
      work_date: workDate,
      calendar_type: calendarType,
      external_event_id: existing?.external_event_id || '',
      last_synced_at: new Date().toISOString(),
      sync_error: errorMsg,
    },
    {
      onConflict: 'assignment_id,user_id,work_date,calendar_type',
    }
  );
}

/**
 * Delete synced event mapping
 */
async function deleteSyncedEvent(
  assignmentId: string,
  userId: string,
  workDate: string,
  calendarType: CalendarType = 'personal'
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('synced_calendar_events')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .eq('calendar_type', calendarType);
}

/**
 * Check if an existing Outlook event exists for this assignment+user+date.
 * Returns the external event ID if found, null otherwise.
 */
async function getExistingEventId(
  assignmentId: string,
  userId: string,
  workDate: string,
  calendarType: CalendarType = 'personal'
): Promise<string | null> {
  const existing = await getSyncedEvent(assignmentId, userId, workDate, calendarType);
  if (existing?.external_event_id && existing.external_event_id !== PENDING_SLOT_MARKER) {
    return existing.external_event_id;
  }
  // Clean up any stale pending markers
  if (existing?.external_event_id === PENDING_SLOT_MARKER) {
    await deleteSyncedEvent(assignmentId, userId, workDate, calendarType);
  }
  return null;
}

// ============================================
// Calendar management
// ============================================

/**
 * Ensure the engineer has an "AmiDash - {FirstName}" calendar in Outlook.
 * Returns the Outlook calendar ID.
 */
export async function ensureAmiDashCalendar(
  userId: string,
  email: string,
  firstName?: string
): Promise<string> {
  const calendarName = firstName ? `AmiDash - ${firstName}` : 'AmiDash';
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('engineer_outlook_calendars')
    .select('id, outlook_calendar_id, outlook_email')
    .eq('user_id', userId)
    .single();

  if (existing?.outlook_calendar_id) {
    const cal = await getCalendarForUser(email, existing.outlook_calendar_id);
    if (cal) {
      if (cal.name !== calendarName) {
        try {
          await updateCalendarForUser(email, existing.outlook_calendar_id, { name: calendarName });
        } catch (err) {
          console.error('Failed to rename AmiDash calendar:', err);
        }
      }
      return existing.outlook_calendar_id;
    }
    console.log('AmiDash calendar deleted from Outlook, recreating for user:', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('engineer_outlook_calendars')
      .delete()
      .eq('id', existing.id);
  }

  const newCal = await createCalendarForUser(email, calendarName);

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

/**
 * Ensure the user has an "AmiDash - Projects" calendar in Outlook.
 * Returns the Outlook calendar ID.
 */
export async function ensureProjectsCalendar(
  userId: string,
  email: string
): Promise<string> {
  const calendarName = 'AmiDash - Projects';
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('engineer_outlook_calendars')
    .select('id, outlook_projects_calendar_id')
    .eq('user_id', userId)
    .single();

  if (existing?.outlook_projects_calendar_id) {
    const cal = await getCalendarForUser(email, existing.outlook_projects_calendar_id);
    if (cal) {
      if (cal.name !== calendarName) {
        try {
          await updateCalendarForUser(email, existing.outlook_projects_calendar_id, { name: calendarName });
        } catch (err) {
          console.error('Failed to rename Projects calendar:', err);
        }
      }
      return existing.outlook_projects_calendar_id;
    }
    // Calendar was deleted — clear the stale ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('engineer_outlook_calendars')
      .update({ outlook_projects_calendar_id: null })
      .eq('id', existing.id);
  }

  const newCal = await createCalendarForUser(email, calendarName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('engineer_outlook_calendars')
    .update({ outlook_projects_calendar_id: newCal.id })
    .eq('user_id', userId);

  return newCal.id;
}

// ============================================
// Single day sync
// ============================================

/**
 * Sync a single assignment day to Outlook.
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
  projectId: string;
  teamMembers: string[];
  pmContact?: string;
  location?: string;
  salesOrderUrl?: string;
  projectDescription?: string;
  calendarType?: CalendarType;
}): Promise<SyncResult> {
  const { assignmentId, userId, email, calendarId, workDate, startTime, endTime } = params;
  const calendarType = params.calendarType || 'personal';

  try {
    const baseUrl = getBaseUrl();
    const event = buildCalendarEvent({
      projectName: params.projectName,
      projectId: params.projectId,
      date: workDate,
      startTime,
      endTime,
      teamMembers: params.teamMembers,
      pmContact: params.pmContact,
      dashboardUrl: baseUrl,
      location: params.location,
      salesOrderUrl: params.salesOrderUrl,
      projectDescription: params.projectDescription,
    });

    // Check for existing synced event
    const existingEventId = await getExistingEventId(assignmentId, userId, workDate, calendarType);

    if (existingEventId) {
      await updateCalendarEvent(email, calendarId, existingEventId, event);
      await storeSyncedEvent(assignmentId, userId, workDate, existingEventId, calendarType);
      return { success: true, eventId: existingEventId };
    }

    const response = await createCalendarEvent(email, calendarId, event);
    await storeSyncedEvent(assignmentId, userId, workDate, response.id, calendarType);
    return { success: true, eventId: response.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to sync day to Outlook:', workDate, errorMessage);
    await updateSyncError(assignmentId, userId, workDate, errorMessage, calendarType);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Public API
// ============================================

/**
 * Main entry point: sync an assignment to Outlook (personal calendar).
 */
export async function triggerAssignmentSync(assignment: {
  id: string;
  user_id: string;
  booking_status: string;
  project_id: string;
  project_name: string;
}): Promise<void> {
  const { id: assignmentId, user_id: userId, booking_status } = assignment;

  if (!SYNCABLE_STATUSES.includes(booking_status as (typeof SYNCABLE_STATUSES)[number])) {
    await deleteAssignmentFromOutlook(assignmentId, userId);
    return;
  }

  const profile = await getEngineerProfile(userId);
  if (!profile) {
    console.error('Cannot sync: no profile found for user', userId);
    return;
  }
  const { email, fullName } = profile;
  const firstName = fullName.split(' ')[0];

  let calendarId: string;
  try {
    calendarId = await ensureAmiDashCalendar(userId, email, firstName);
  } catch (err) {
    console.error('Failed to ensure AmiDash calendar for user:', userId, err);
    return;
  }

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

  const { data: projectData } = await supabase
    .from('projects')
    .select('delivery_street, delivery_city, delivery_state, delivery_zip, project_description, sales_order_url, odoo_order_id')
    .eq('id', assignment.project_id)
    .single();

  const salesOrderUrl = buildSalesOrderUrl(projectData?.sales_order_url, projectData?.odoo_order_id);
  const location = buildLocation(projectData);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teamData } = await (supabase as any)
    .from('project_assignments')
    .select('user_id, profile:profiles(full_name)')
    .eq('project_id', assignment.project_id)
    .neq('user_id', userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamMembers = (teamData || []).map((m: any) => m.profile?.full_name || 'Unknown');

  // Detect orphaned days (personal calendar only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingSynced } = await (supabase as any)
    .from('synced_calendar_events')
    .select('work_date, external_event_id')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('calendar_type', 'personal');

  const currentDates = new Set(days.map((d: { work_date: string }) => d.work_date));
  const orphanedEvents = (existingSynced || []).filter(
    (e: { work_date: string }) => !currentDates.has(e.work_date)
  );

  for (const orphan of orphanedEvents) {
    if (orphan.external_event_id && orphan.external_event_id !== PENDING_SLOT_MARKER) {
      try {
        await deleteCalendarEvent(email, calendarId, orphan.external_event_id);
      } catch (err) {
        console.error('Failed to delete orphaned event:', orphan.work_date, err);
      }
    }
    await deleteSyncedEvent(assignmentId, userId, orphan.work_date, 'personal');
  }

  const syncTasks = days.map((day: { work_date: string; start_time: string; end_time: string }) => ({
    execute: () =>
      syncDayToOutlook({
        assignmentId,
        userId,
        email,
        calendarId,
        workDate: day.work_date,
        startTime: day.start_time.slice(0, 5),
        endTime: day.end_time.slice(0, 5),
        projectName: assignment.project_name,
        projectId: assignment.project_id,
        teamMembers,
        location,
        salesOrderUrl,
        projectDescription: projectData?.project_description || undefined,
        calendarType: 'personal',
      }),
  }));

  for (let i = 0; i < syncTasks.length; i += CONCURRENCY_LIMIT) {
    const batch = syncTasks.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.allSettled(batch.map((task: { execute: () => Promise<SyncResult> }) => task.execute()));
  }
}

/**
 * Delete all personal Outlook events for an assignment+user.
 * Projects calendar events are managed by fullProjectsSyncForUser (date-range based).
 */
export async function deleteAssignmentFromOutlook(
  assignmentId: string,
  userId: string
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: syncedEvents, error } = await (supabase as any)
    .from('synced_calendar_events')
    .select('id, work_date, external_event_id')
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('calendar_type', 'personal');

  if (error || !syncedEvents || syncedEvents.length === 0) {
    return;
  }

  const profile = await getEngineerProfile(userId);
  if (!profile) {
    console.error('Cannot delete events: no profile found for user', userId);
    return;
  }
  const email = profile.email;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: calRecord } = await (supabase as any)
    .from('engineer_outlook_calendars')
    .select('outlook_calendar_id')
    .eq('user_id', userId)
    .single();

  if (calRecord?.outlook_calendar_id) {
    for (const event of syncedEvents) {
      if (event.external_event_id && event.external_event_id !== PENDING_SLOT_MARKER) {
        try {
          await deleteCalendarEvent(email, calRecord.outlook_calendar_id, event.external_event_id);
        } catch (err) {
          console.error('Failed to delete Outlook event:', event.external_event_id, err);
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('synced_calendar_events')
    .delete()
    .eq('assignment_id', assignmentId)
    .eq('user_id', userId)
    .eq('calendar_type', 'personal');
}

/**
 * Full sync for a user: sync all their confirmed assignments to personal calendar.
 */
export async function fullSyncForUser(userId: string): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createServiceClient();

  const profile = await getEngineerProfile(userId);
  if (!profile) {
    return { synced: 0, failed: 0, errors: ['No profile found for user'] };
  }
  const { email, fullName } = profile;
  const firstName = fullName.split(' ')[0];

  let calendarId: string;
  try {
    calendarId = await ensureAmiDashCalendar(userId, email, firstName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { synced: 0, failed: 0, errors: [`Failed to ensure calendar: ${msg}`] };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select(`
      id,
      user_id,
      project_id,
      booking_status,
      project:projects!inner(
        id,
        client_name,
        delivery_street,
        delivery_city,
        delivery_state,
        delivery_zip,
        project_description,
        sales_order_url,
        odoo_order_id
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

  const daysByAssignment = new Map<string, Array<{ work_date: string; start_time: string; end_time: string }>>();
  for (const day of allDays || []) {
    if (!daysByAssignment.has(day.assignment_id)) {
      daysByAssignment.set(day.assignment_id, []);
    }
    daysByAssignment.get(day.assignment_id)!.push(day);
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncTasks: Array<{ projectName: string; execute: () => Promise<SyncResult> }> = [];

  for (const assignment of assignments) {
    const days = daysByAssignment.get(assignment.id) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = (assignment as any).project;
    const projectName = project?.client_name || 'Unknown';
    const teamMembers = teamByProject.get(assignment.project_id) || [];
    const location = buildLocation(project);
    const projectSalesOrderUrl = buildSalesOrderUrl(project?.sales_order_url, project?.odoo_order_id);

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
            projectId: assignment.project_id,
            teamMembers,
            location,
            salesOrderUrl: projectSalesOrderUrl,
            projectDescription: project?.project_description || undefined,
            calendarType: 'personal',
          }),
      });
    }
  }

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
 * Full sync of ALL project date ranges to a user's "AmiDash - Projects" calendar.
 * Groups all assignment days by project into contiguous weekday ranges,
 * then creates one all-day multi-day event per range.
 * Includes pending and confirmed projects.
 */
export async function fullProjectsSyncForUser(userId: string): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = await createServiceClient();

  const profile = await getEngineerProfile(userId);
  if (!profile) {
    return { synced: 0, failed: 0, errors: ['No profile found for user'] };
  }
  const { email } = profile;

  let projectsCalendarId: string;
  try {
    projectsCalendarId = await ensureProjectsCalendar(userId, email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { synced: 0, failed: 0, errors: [`Failed to ensure Projects calendar: ${msg}`] };
  }

  // Get ALL pending/confirmed assignments across ALL engineers
  const { data: assignments, error: assignmentsError } = await supabase
    .from('project_assignments')
    .select(`
      id,
      user_id,
      project_id,
      booking_status,
      profile:profiles!inner(full_name),
      project:projects!inner(
        id,
        client_name,
        delivery_street,
        delivery_city,
        delivery_state,
        delivery_zip,
        project_description,
        sales_order_url,
        odoo_order_id
      )
    `)
    .in('booking_status', [...PROJECTS_CALENDAR_STATUSES]);

  if (assignmentsError) {
    console.error('Failed to fetch assignments for projects sync:', assignmentsError);
    return { synced: 0, failed: 0, errors: ['Failed to fetch assignments'] };
  }

  if (!assignments || assignments.length === 0) {
    // Clean up any existing project events since there are no assignments
    await deleteAllProjectEventsForUser(userId, email, projectsCalendarId);
    return { synced: 0, failed: 0, errors: [] };
  }

  // Fetch all assignment_days
  const assignmentIds = assignments.map((a) => a.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allDays, error: daysError } = await (supabase as any)
    .from('assignment_days')
    .select('assignment_id, work_date')
    .in('assignment_id', assignmentIds)
    .order('work_date', { ascending: true });

  if (daysError) {
    console.error('Failed to fetch assignment days for projects sync:', daysError);
    return { synced: 0, failed: 0, errors: ['Failed to fetch assignment days'] };
  }

  // Group days by project, collecting all dates and engineer names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectMap = new Map<string, {
    projectName: string;
    projectId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    project: any;
    engineers: Set<string>;
    dates: Set<string>;
    bookingStatus: string;
  }>();

  for (const assignment of assignments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = (assignment as any).project;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assigneeProfile = (assignment as any).profile;
    const projectId = assignment.project_id;

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        projectName: project?.client_name || 'Unknown',
        projectId,
        project,
        engineers: new Set(),
        dates: new Set(),
        // Use the "highest" status — confirmed > pending
        bookingStatus: assignment.booking_status,
      });
    }

    const entry = projectMap.get(projectId)!;
    entry.engineers.add(assigneeProfile?.full_name || 'Unknown');
    if (assignment.booking_status === 'confirmed') {
      entry.bookingStatus = 'confirmed';
    }

    // Add this assignment's days
    const assignmentDays = (allDays || []).filter(
      (d: { assignment_id: string }) => d.assignment_id === assignment.id
    );
    for (const day of assignmentDays) {
      entry.dates.add(day.work_date);
    }
  }

  // For each project, compute contiguous date ranges
  const baseUrl = getBaseUrl();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  // Track which (project_id, range_start) combos we want to keep
  const desiredRanges: Array<{ projectId: string; rangeStart: string }> = [];

  for (const [, entry] of projectMap) {
    const sortedDates = [...entry.dates].sort();
    const ranges = groupDaysIntoRanges(sortedDates);
    const location = buildLocation(entry.project);
    const salesOrderUrl = buildSalesOrderUrl(entry.project?.sales_order_url, entry.project?.odoo_order_id);

    for (const range of ranges) {
      desiredRanges.push({ projectId: entry.projectId, rangeStart: range.start });

      const event = buildProjectCalendarEvent({
        projectName: entry.projectName,
        projectId: entry.projectId,
        range,
        engineers: [...entry.engineers],
        location,
        salesOrderUrl,
        projectDescription: entry.project?.project_description || undefined,
        bookingStatus: entry.bookingStatus,
        dashboardUrl: baseUrl,
      });

      try {
        // Check if we already have a synced event for this project+range
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from('synced_project_calendar_events')
          .select('id, external_event_id')
          .eq('project_id', entry.projectId)
          .eq('user_id', userId)
          .eq('range_start', range.start)
          .single();

        if (existing?.external_event_id) {
          // Update existing event
          await updateCalendarEvent(email, projectsCalendarId, existing.external_event_id, event);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('synced_project_calendar_events')
            .update({
              range_end: range.end,
              last_synced_at: new Date().toISOString(),
              sync_error: null,
            })
            .eq('id', existing.id);
          synced++;
        } else {
          // Create new event
          const response = await createCalendarEvent(email, projectsCalendarId, event);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('synced_project_calendar_events').upsert(
            {
              project_id: entry.projectId,
              user_id: userId,
              range_start: range.start,
              range_end: range.end,
              external_event_id: response.id,
              last_synced_at: new Date().toISOString(),
              sync_error: null,
            },
            { onConflict: 'project_id,user_id,range_start' }
          );
          synced++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to sync project range:', entry.projectName, range, errorMessage);
        errors.push(`${entry.projectName}: ${errorMessage}`);
        failed++;
      }
    }
  }

  // Clean up orphaned project events (ranges that no longer exist)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allExisting } = await (supabase as any)
    .from('synced_project_calendar_events')
    .select('id, project_id, range_start, external_event_id')
    .eq('user_id', userId);

  for (const existing of allExisting || []) {
    const isDesired = desiredRanges.some(
      (r) => r.projectId === existing.project_id && r.rangeStart === existing.range_start
    );
    if (!isDesired && existing.external_event_id) {
      try {
        await deleteCalendarEvent(email, projectsCalendarId, existing.external_event_id);
      } catch (err) {
        console.error('Failed to delete orphaned project event:', err);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('synced_project_calendar_events')
        .delete()
        .eq('id', existing.id);
    }
  }

  return { synced, failed, errors };
}

/**
 * Delete all project calendar events for a user (cleanup helper).
 */
async function deleteAllProjectEventsForUser(
  userId: string,
  email: string,
  projectsCalendarId: string
): Promise<void> {
  const supabase = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = await (supabase as any)
    .from('synced_project_calendar_events')
    .select('id, external_event_id')
    .eq('user_id', userId);

  for (const event of events || []) {
    if (event.external_event_id) {
      try {
        await deleteCalendarEvent(email, projectsCalendarId, event.external_event_id);
      } catch (err) {
        console.error('Failed to delete project event:', err);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('synced_project_calendar_events')
    .delete()
    .eq('user_id', userId);
}

/**
 * Sync all assignments for a project to Outlook.
 * Called when project data changes (name, dates, etc.).
 */
export async function syncProjectAssignmentsToOutlook(projectId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_name')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error('Failed to fetch project for Outlook sync:', projectError);
    return;
  }

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
 */
export async function retrySyncForAssignment(
  assignmentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServiceClient();

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
