'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  BookingStatus,
  ProjectAssignment,
  AssignmentExcludedDate,
  AssignmentDay,
  AssignmentBlock,
  GanttAssignment,
  BookingConflict,
  ConflictCheckResult,
  CalendarAssignmentResult,
  UserScheduleResult,
} from '@/types/calendar';

// ============================================
// Result types
// ============================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateAssignmentResult {
  success: boolean;
  assignment?: ProjectAssignment;
  conflicts?: ConflictCheckResult;
  error?: string;
}

// ============================================
// Helper functions
// ============================================

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication required', supabase: null, user: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Admin access required', supabase: null, user: null };
  }

  return { error: null, supabase, user };
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication required', supabase: null, user: null };
  }

  return { error: null, supabase, user };
}

// ============================================
// Assignment CRUD operations
// ============================================

export async function createAssignment(data: {
  projectId: string;
  userId: string;
  bookingStatus?: BookingStatus;
  notes?: string;
}): Promise<CreateAssignmentResult> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // Get project dates for conflict checking
  const { data: projectData } = await supabase
    .from('projects')
    .select('id, client_name, start_date, end_date')
    .eq('id', data.projectId)
    .single();

  // Cast to include new columns (until types are regenerated)
  const project = projectData as {
    id: string;
    client_name: string;
    start_date: string | null;
    end_date: string | null
  } | null;

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (!project.start_date || !project.end_date) {
    return { success: false, error: 'Project must have start and end dates before assigning users' };
  }

  // Check for conflicts
  const conflictCheck = await checkConflicts({
    userId: data.userId,
    startDate: project.start_date,
    endDate: project.end_date,
  });

  // Create the assignment
  const { data: assignment, error: insertError } = await supabase
    .from('project_assignments')
    .insert({
      project_id: data.projectId,
      user_id: data.userId,
      booking_status: data.bookingStatus || 'pencil',
      notes: data.notes || null,
      created_by: user.id,
    })
    .select(`
      *,
      project:projects(id, client_name, start_date, end_date),
      user:profiles!user_id(id, email, full_name)
    `)
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: 'User is already assigned to this project' };
    }
    console.error('Assignment insert error:', insertError);
    return { success: false, error: 'Failed to create assignment' };
  }

  // Create initial status history entry
  await supabase.from('booking_status_history').insert({
    assignment_id: assignment.id,
    old_status: null,
    new_status: data.bookingStatus || 'pencil',
    changed_by: user.id,
    note: 'Initial assignment',
  });

  // Create conflict records if any
  if (conflictCheck.hasConflicts) {
    for (const conflict of conflictCheck.conflicts) {
      await supabase.from('booking_conflicts').insert({
        user_id: data.userId,
        assignment_id_1: assignment.id,
        assignment_id_2: conflict.assignmentId,
        conflict_date: conflict.conflictDate,
        is_resolved: false,
      });
    }
  }

  revalidatePath('/calendar');
  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath('/my-schedule');

  return {
    success: true,
    assignment: assignment as unknown as ProjectAssignment,
    conflicts: conflictCheck.hasConflicts ? conflictCheck : undefined,
  };
}

export async function updateAssignmentStatus(data: {
  assignmentId: string;
  newStatus: BookingStatus;
  note?: string;
}): Promise<ActionResult> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // Get current assignment
  const { data: currentAssignment } = await supabase
    .from('project_assignments')
    .select('id, booking_status, project_id')
    .eq('id', data.assignmentId)
    .single();

  if (!currentAssignment) {
    return { success: false, error: 'Assignment not found' };
  }

  // Update the assignment
  const { error: updateError } = await supabase
    .from('project_assignments')
    .update({ booking_status: data.newStatus })
    .eq('id', data.assignmentId);

  if (updateError) {
    console.error('Assignment update error:', updateError);
    return { success: false, error: 'Failed to update assignment status' };
  }

  // Record in history
  await supabase.from('booking_status_history').insert({
    assignment_id: data.assignmentId,
    old_status: currentAssignment.booking_status,
    new_status: data.newStatus,
    changed_by: user.id,
    note: data.note || null,
  });

  revalidatePath('/calendar');
  revalidatePath(`/projects/${currentAssignment.project_id}`);
  revalidatePath('/my-schedule');

  return { success: true };
}

export async function removeAssignment(assignmentId: string): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // Get project ID before deleting for cache invalidation
  const { data: assignment } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('id', assignmentId)
    .single();

  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }

  const { error: deleteError } = await supabase
    .from('project_assignments')
    .delete()
    .eq('id', assignmentId);

  if (deleteError) {
    console.error('Assignment delete error:', deleteError);
    return { success: false, error: 'Failed to remove assignment' };
  }

  revalidatePath('/calendar');
  revalidatePath(`/projects/${assignment.project_id}`);
  revalidatePath('/my-schedule');

  return { success: true };
}

// ============================================
// Excluded dates operations
// ============================================

export async function addExcludedDates(data: {
  assignmentId: string;
  dates: string[];
  reason?: string;
}): Promise<ActionResult<AssignmentExcludedDate[]>> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const excludedDates = data.dates.map(date => ({
    assignment_id: data.assignmentId,
    excluded_date: date,
    reason: data.reason || null,
    created_by: user.id,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('assignment_excluded_dates')
    .insert(excludedDates)
    .select();

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: 'Some dates are already excluded' };
    }
    console.error('Excluded dates insert error:', insertError);
    return { success: false, error: 'Failed to add excluded dates' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true, data: inserted as AssignmentExcludedDate[] };
}

export async function removeExcludedDate(excludedDateId: string): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { error: deleteError } = await supabase
    .from('assignment_excluded_dates')
    .delete()
    .eq('id', excludedDateId);

  if (deleteError) {
    console.error('Excluded date delete error:', deleteError);
    return { success: false, error: 'Failed to remove excluded date' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true };
}

export async function bulkRemoveExcludedDates(excludedDateIds: string[]): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { error: deleteError } = await supabase
    .from('assignment_excluded_dates')
    .delete()
    .in('id', excludedDateIds);

  if (deleteError) {
    console.error('Bulk excluded dates delete error:', deleteError);
    return { success: false, error: 'Failed to remove excluded dates' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true };
}

// ============================================
// Project dates operations
// ============================================

export async function updateProjectDates(data: {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
}): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // Validate dates
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end < start) {
      return { success: false, error: 'End date must be after start date' };
    }
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      start_date: data.startDate,
      end_date: data.endDate,
    })
    .eq('id', data.projectId);

  if (updateError) {
    console.error('Project dates update error:', updateError);
    return { success: false, error: 'Failed to update project dates' };
  }

  revalidatePath('/calendar');
  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath('/projects');

  return { success: true };
}

// ============================================
// Conflict operations
// ============================================

export async function checkConflicts(data: {
  userId: string;
  startDate: string;
  endDate: string;
  excludeAssignmentId?: string;
}): Promise<ConflictCheckResult> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { hasConflicts: false, conflicts: [] };
  }

  const { data: conflicts, error } = await supabase.rpc('check_user_conflicts', {
    p_user_id: data.userId,
    p_start_date: data.startDate,
    p_end_date: data.endDate,
    p_exclude_assignment_id: data.excludeAssignmentId || null,
  });

  if (error) {
    console.error('Conflict check error:', error);
    return { hasConflicts: false, conflicts: [] };
  }

  const conflictList = (conflicts || []).map((c: {
    conflicting_project_id: string;
    conflicting_project_name: string;
    conflict_date: string;
    conflicting_assignment_id: string;
  }) => ({
    projectId: c.conflicting_project_id,
    projectName: c.conflicting_project_name,
    conflictDate: c.conflict_date,
    assignmentId: c.conflicting_assignment_id,
  }));

  return {
    hasConflicts: conflictList.length > 0,
    conflicts: conflictList,
  };
}

export async function overrideConflict(data: {
  conflictId: string;
  reason: string;
}): Promise<ActionResult> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  if (!data.reason.trim()) {
    return { success: false, error: 'A reason is required to override a conflict' };
  }

  const { error: updateError } = await supabase
    .from('booking_conflicts')
    .update({
      override_reason: data.reason.trim(),
      overridden_by: user.id,
      overridden_at: new Date().toISOString(),
      is_resolved: true,
    })
    .eq('id', data.conflictId);

  if (updateError) {
    console.error('Conflict override error:', updateError);
    return { success: false, error: 'Failed to override conflict' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true };
}

export async function getUnresolvedConflicts(userId?: string): Promise<ActionResult<BookingConflict[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  let query = supabase
    .from('booking_conflicts')
    .select(`
      *,
      user:profiles!booking_conflicts_user_id_fkey(id, email, full_name),
      assignment1:project_assignments!booking_conflicts_assignment_id_1_fkey(
        id, project_id, booking_status,
        project:projects(id, client_name)
      ),
      assignment2:project_assignments!booking_conflicts_assignment_id_2_fkey(
        id, project_id, booking_status,
        project:projects(id, client_name)
      )
    `)
    .eq('is_resolved', false);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get conflicts error:', error);
    return { success: false, error: 'Failed to fetch conflicts' };
  }

  return { success: true, data: data as BookingConflict[] };
}

// ============================================
// Calendar data queries
// ============================================

export async function getCalendarData(params: {
  startDate: string;
  endDate: string;
  projectId?: string;
  userId?: string;
}): Promise<ActionResult<CalendarAssignmentResult[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase.rpc('get_calendar_assignments', {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_project_id: params.projectId || null,
  });

  if (error) {
    console.error('Get calendar data error:', error);
    return { success: false, error: 'Failed to fetch calendar data' };
  }

  let result = data as CalendarAssignmentResult[];

  // Filter by user if specified
  if (params.userId) {
    result = result.filter(a => a.user_id === params.userId);
  }

  return { success: true, data: result };
}

export async function getUserSchedule(params: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult<UserScheduleResult[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase.rpc('get_user_schedule', {
    p_user_id: params.userId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
  });

  if (error) {
    console.error('Get user schedule error:', error);
    return { success: false, error: 'Failed to fetch user schedule' };
  }

  return { success: true, data: data as UserScheduleResult[] };
}

export async function getProjectAssignments(projectId: string): Promise<ActionResult<ProjectAssignment[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase
    .from('project_assignments')
    .select(`
      *,
      user:profiles!user_id(id, email, full_name),
      excluded_dates:assignment_excluded_dates(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Get project assignments error:', error);
    return { success: false, error: 'Failed to fetch assignments' };
  }

  return { success: true, data: data as unknown as ProjectAssignment[] };
}

export async function getAssignment(assignmentId: string): Promise<ActionResult<ProjectAssignment>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase
    .from('project_assignments')
    .select(`
      *,
      project:projects(id, client_name, start_date, end_date),
      user:profiles!user_id(id, email, full_name),
      excluded_dates:assignment_excluded_dates(*)
    `)
    .eq('id', assignmentId)
    .single();

  if (error) {
    console.error('Get assignment error:', error);
    return { success: false, error: 'Failed to fetch assignment' };
  }

  return { success: true, data: data as unknown as ProjectAssignment };
}

// ============================================
// Admin users for assignment
// ============================================

export async function getAdminUsersForAssignment(): Promise<ActionResult<{ id: string; email: string; full_name: string | null }[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'admin')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Get admin users error:', error);
    return { success: false, error: 'Failed to fetch admin users' };
  }

  return { success: true, data: data || [] };
}

// ============================================
// Calendar subscription operations
// ============================================

export async function createCalendarSubscription(data: {
  feedType: 'master' | 'personal' | 'project';
  projectId?: string;
}): Promise<ActionResult<{ token: string; url: string }>> {
  const { error: authError, supabase, user } = await getAuthenticatedClient();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // Check if subscription already exists
  let query = supabase
    .from('calendar_subscriptions')
    .select('id, token')
    .eq('user_id', user.id)
    .eq('feed_type', data.feedType);

  if (data.projectId) {
    query = query.eq('project_id', data.projectId);
  } else {
    query = query.is('project_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return {
      success: true,
      data: {
        token: existing.token,
        url: `${baseUrl}/api/calendar/ical/${existing.token}`,
      },
    };
  }

  // Create new subscription
  const { data: subscription, error: insertError } = await supabase
    .from('calendar_subscriptions')
    .insert({
      user_id: user.id,
      feed_type: data.feedType,
      project_id: data.projectId || null,
    })
    .select('token')
    .single();

  if (insertError) {
    console.error('Create subscription error:', insertError);
    return { success: false, error: 'Failed to create subscription' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return {
    success: true,
    data: {
      token: subscription.token,
      url: `${baseUrl}/api/calendar/ical/${subscription.token}`,
    },
  };
}

export async function getMySubscriptions(): Promise<ActionResult<{
  id: string;
  feed_type: string;
  project_id: string | null;
  token: string;
  created_at: string | null;
}[]>> {
  const { error: authError, supabase, user } = await getAuthenticatedClient();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .select('id, feed_type, project_id, token, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Get subscriptions error:', error);
    return { success: false, error: 'Failed to fetch subscriptions' };
  }

  return { success: true, data: data || [] };
}

export async function deleteCalendarSubscription(subscriptionId: string): Promise<ActionResult> {
  const { error: authError, supabase, user } = await getAuthenticatedClient();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { error: deleteError } = await supabase
    .from('calendar_subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('Delete subscription error:', deleteError);
    return { success: false, error: 'Failed to delete subscription' };
  }

  return { success: true };
}

// ============================================
// Assignment Days operations (new model)
// ============================================

/**
 * Add days to an assignment with start/end times
 */
export async function addAssignmentDays(data: {
  assignmentId: string;
  days: { date: string; startTime: string; endTime: string }[];
}): Promise<ActionResult<AssignmentDay[]>> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  if (data.days.length === 0) {
    return { success: false, error: 'No days provided' };
  }

  // Validate time order for each day
  for (const day of data.days) {
    if (day.endTime <= day.startTime) {
      return { success: false, error: `End time must be after start time for ${day.date}` };
    }
  }

  const assignmentDays = data.days.map(day => ({
    assignment_id: data.assignmentId,
    work_date: day.date,
    start_time: day.startTime,
    end_time: day.endTime,
    created_by: user.id,
  }));

  // Type assertion needed until migration runs and types are regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (supabase as any)
    .from('assignment_days')
    .insert(assignmentDays)
    .select();

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: 'Some days are already scheduled for this assignment' };
    }
    console.error('Assignment days insert error:', insertError);
    return { success: false, error: 'Failed to add assignment days' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true, data: inserted as AssignmentDay[] };
}

/**
 * Update times for a specific assignment day
 */
export async function updateAssignmentDay(data: {
  dayId: string;
  startTime: string;
  endTime: string;
}): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  if (data.endTime <= data.startTime) {
    return { success: false, error: 'End time must be after start time' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('assignment_days')
    .update({
      start_time: data.startTime,
      end_time: data.endTime,
    })
    .eq('id', data.dayId);

  if (updateError) {
    console.error('Assignment day update error:', updateError);
    return { success: false, error: 'Failed to update assignment day' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true };
}

/**
 * Remove specific days from an assignment
 */
export async function removeAssignmentDays(dayIds: string[]): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  if (dayIds.length === 0) {
    return { success: false, error: 'No day IDs provided' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from('assignment_days')
    .delete()
    .in('id', dayIds);

  if (deleteError) {
    console.error('Assignment days delete error:', deleteError);
    return { success: false, error: 'Failed to remove assignment days' };
  }

  revalidatePath('/calendar');
  revalidatePath('/my-schedule');

  return { success: true };
}

/**
 * Get all days for an assignment
 */
export async function getAssignmentDays(assignmentId: string): Promise<ActionResult<AssignmentDay[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('assignment_days')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('work_date', { ascending: true });

  if (error) {
    console.error('Get assignment days error:', error);
    return { success: false, error: 'Failed to fetch assignment days' };
  }

  return { success: true, data: data as AssignmentDay[] };
}

// ============================================
// Status cycling (click-to-toggle)
// ============================================

const STATUS_CYCLE: BookingStatus[] = ['pencil', 'pending_confirm', 'confirmed'];

/**
 * Cycle assignment status: pencil → pending_confirm → confirmed → pencil
 */
export async function cycleAssignmentStatus(assignmentId: string): Promise<ActionResult<{ newStatus: BookingStatus }>> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // Get current assignment
  const { data: currentAssignment } = await supabase
    .from('project_assignments')
    .select('id, booking_status, project_id')
    .eq('id', assignmentId)
    .single();

  if (!currentAssignment) {
    return { success: false, error: 'Assignment not found' };
  }

  // Calculate next status
  const currentIndex = STATUS_CYCLE.indexOf(currentAssignment.booking_status as BookingStatus);
  const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
  const newStatus = STATUS_CYCLE[nextIndex];

  // Update the assignment
  const { error: updateError } = await supabase
    .from('project_assignments')
    .update({ booking_status: newStatus })
    .eq('id', assignmentId);

  if (updateError) {
    console.error('Assignment status cycle error:', updateError);
    return { success: false, error: 'Failed to update assignment status' };
  }

  // Record in history
  await supabase.from('booking_status_history').insert({
    assignment_id: assignmentId,
    old_status: currentAssignment.booking_status,
    new_status: newStatus,
    changed_by: user.id,
    note: 'Status cycled via click',
  });

  revalidatePath('/calendar');
  revalidatePath(`/projects/${currentAssignment.project_id}`);
  revalidatePath('/my-schedule');

  return { success: true, data: { newStatus } };
}

// ============================================
// Assignable users
// ============================================

/**
 * Get users who can be assigned to projects (is_assignable = true)
 */
export async function getAssignableUsers(): Promise<ActionResult<{ id: string; email: string; full_name: string | null }[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('is_assignable', true)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Get assignable users error:', error);
    return { success: false, error: 'Failed to fetch assignable users' };
  }

  return { success: true, data: data || [] };
}

/**
 * Update a user's assignable status
 */
export async function updateUserAssignable(data: {
  userId: string;
  isAssignable: boolean;
}): Promise<ActionResult> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('profiles')
    .update({ is_assignable: data.isAssignable })
    .eq('id', data.userId);

  if (updateError) {
    console.error('Update user assignable error:', updateError);
    return { success: false, error: 'Failed to update user assignable status' };
  }

  revalidatePath('/admin/users');
  revalidatePath('/calendar');

  return { success: true };
}

// ============================================
// Gantt data operations
// ============================================

/**
 * Helper function to group consecutive days into blocks
 */
function groupDaysIntoBlocks(days: AssignmentDay[]): AssignmentBlock[] {
  if (days.length === 0) return [];

  // Sort days by date
  const sortedDays = [...days].sort((a, b) =>
    new Date(a.work_date).getTime() - new Date(b.work_date).getTime()
  );

  const blocks: AssignmentBlock[] = [];
  let currentBlock: AssignmentDay[] = [sortedDays[0]];

  for (let i = 1; i < sortedDays.length; i++) {
    const prevDate = new Date(sortedDays[i - 1].work_date);
    const currDate = new Date(sortedDays[i].work_date);

    // Check if dates are consecutive (1 day apart)
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day, add to current block
      currentBlock.push(sortedDays[i]);
    } else {
      // Gap found, finish current block and start new one
      blocks.push({
        startDate: currentBlock[0].work_date,
        endDate: currentBlock[currentBlock.length - 1].work_date,
        days: currentBlock,
      });
      currentBlock = [sortedDays[i]];
    }
  }

  // Add the last block
  blocks.push({
    startDate: currentBlock[0].work_date,
    endDate: currentBlock[currentBlock.length - 1].work_date,
    days: currentBlock,
  });

  return blocks;
}

/**
 * Get assignment with days grouped into blocks for Gantt display
 */
export async function getAssignmentWithDays(assignmentId: string): Promise<ActionResult<ProjectAssignment & { days: AssignmentDay[] }>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('project_assignments')
    .select(`
      *,
      project:projects(id, client_name, start_date, end_date),
      user:profiles!user_id(id, email, full_name),
      days:assignment_days(*)
    `)
    .eq('id', assignmentId)
    .single();

  if (error) {
    console.error('Get assignment with days error:', error);
    return { success: false, error: 'Failed to fetch assignment' };
  }

  return { success: true, data: data as unknown as ProjectAssignment & { days: AssignmentDay[] } };
}

/**
 * Get all assignments for a project formatted for Gantt display
 */
export async function getProjectAssignmentsForGantt(projectId: string): Promise<ActionResult<GanttAssignment[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('project_assignments')
    .select(`
      *,
      project:projects(id, client_name, start_date, end_date),
      user:profiles!user_id(id, email, full_name),
      days:assignment_days(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Get project assignments for Gantt error:', error);
    return { success: false, error: 'Failed to fetch assignments' };
  }

  // Transform into GanttAssignment format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ganttAssignments: GanttAssignment[] = (data || []).map((assignment: any) => {
    const days = (assignment.days || []) as AssignmentDay[];
    const blocks = groupDaysIntoBlocks(days);
    const user = assignment.user as { id: string; email: string; full_name: string | null } | null;
    const project = assignment.project as { id: string; client_name: string; start_date: string | null; end_date: string | null } | null;

    return {
      id: `gantt-${assignment.id}`,
      assignmentId: assignment.id,
      userId: assignment.user_id,
      userName: user?.full_name || user?.email || 'Unknown',
      projectId: assignment.project_id,
      projectName: project?.client_name || 'Unknown Project',
      projectStartDate: project?.start_date || null,
      projectEndDate: project?.end_date || null,
      bookingStatus: assignment.booking_status as BookingStatus,
      notes: assignment.notes,
      blocks,
    };
  });

  return { success: true, data: ganttAssignments };
}

/**
 * Get Gantt data for a date range (all projects, all users)
 */
export async function getGanttDataForRange(params: {
  startDate: string;
  endDate: string;
  userId?: string;
}): Promise<ActionResult<GanttAssignment[]>> {
  const { error: authError, supabase } = await getAuthenticatedClient();
  if (authError || !supabase) {
    return { success: false, error: authError || 'Authentication failed' };
  }

  // First get all assignment days in the range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const daysQuery = (supabase as any)
    .from('assignment_days')
    .select('assignment_id')
    .gte('work_date', params.startDate)
    .lte('work_date', params.endDate);

  const { data: daysInRange, error: daysError } = await daysQuery;

  if (daysError) {
    console.error('Get days in range error:', daysError);
    return { success: false, error: 'Failed to fetch assignment days' };
  }

  if (!daysInRange || daysInRange.length === 0) {
    return { success: true, data: [] };
  }

  // Get unique assignment IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentIds = [...new Set(daysInRange.map((d: any) => d.assignment_id))];

  // Fetch full assignments with user filtering if needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignmentsQuery = (supabase as any)
    .from('project_assignments')
    .select(`
      *,
      project:projects(id, client_name, start_date, end_date),
      user:profiles!user_id(id, email, full_name),
      days:assignment_days(*)
    `)
    .in('id', assignmentIds);

  if (params.userId) {
    assignmentsQuery = assignmentsQuery.eq('user_id', params.userId);
  }

  const { data, error } = await assignmentsQuery;

  if (error) {
    console.error('Get assignments for Gantt range error:', error);
    return { success: false, error: 'Failed to fetch assignments' };
  }

  // Transform into GanttAssignment format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ganttAssignments: GanttAssignment[] = (data || []).map((assignment: any) => {
    const days = (assignment.days || []) as AssignmentDay[];
    // Filter days to only include those in the requested range
    const filteredDays = days.filter(d =>
      d.work_date >= params.startDate && d.work_date <= params.endDate
    );
    const blocks = groupDaysIntoBlocks(filteredDays);
    const user = assignment.user as { id: string; email: string; full_name: string | null } | null;
    const project = assignment.project as { id: string; client_name: string; start_date: string | null; end_date: string | null } | null;

    return {
      id: `gantt-${assignment.id}`,
      assignmentId: assignment.id,
      userId: assignment.user_id,
      userName: user?.full_name || user?.email || 'Unknown',
      projectId: assignment.project_id,
      projectName: project?.client_name || 'Unknown Project',
      projectStartDate: project?.start_date || null,
      projectEndDate: project?.end_date || null,
      bookingStatus: assignment.booking_status as BookingStatus,
      notes: assignment.notes,
      blocks,
    };
  });

  return { success: true, data: ganttAssignments };
}
