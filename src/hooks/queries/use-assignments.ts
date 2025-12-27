import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  ProjectAssignment,
  BookingStatus,
  CalendarAssignmentResult,
  UserScheduleResult,
  AssignmentDay,
  GanttAssignment,
} from '@/types/calendar';
import {
  createAssignment,
  updateAssignmentStatus,
  removeAssignment,
  addExcludedDates,
  removeExcludedDate,
  bulkRemoveExcludedDates,
  updateProjectDates,
  checkConflicts,
  overrideConflict,
  getAdminUsersForAssignment,
  createCalendarSubscription,
  getMySubscriptions,
  deleteCalendarSubscription,
  // New actions for Gantt/day management
  addAssignmentDays,
  updateAssignmentDay,
  removeAssignmentDays,
  getAssignmentDays,
  cycleAssignmentStatus,
  getAssignableUsers,
  updateUserAssignable,
  getProjectAssignmentsForGantt,
  getGanttDataForRange,
  // Calendar data server action
  getCalendarData,
  getUnresolvedConflicts,
} from '@/app/(dashboard)/calendar/actions';

// Query keys
export const ASSIGNMENTS_KEY = ['assignments'];
export const CALENDAR_KEY = ['calendar'];
export const USER_SCHEDULE_KEY = ['userSchedule'];
export const ADMIN_USERS_KEY = ['adminUsers'];
export const SUBSCRIPTIONS_KEY = ['calendarSubscriptions'];
export const ASSIGNABLE_USERS_KEY = ['assignableUsers'];
export const ASSIGNMENT_DAYS_KEY = ['assignmentDays'];
export const GANTT_KEY = ['gantt'];
export const CONFLICTS_KEY = ['bookingConflicts'];

const ONE_MINUTE = 60 * 1000;
const THIRTY_SECONDS = 30 * 1000;

// ============================================
// Query hooks
// ============================================

export function useProjectAssignments(projectId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...ASSIGNMENTS_KEY, 'project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          *,
          user:profiles!user_id(id, email, full_name),
          excluded_dates:assignment_excluded_dates(*)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as ProjectAssignment[];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!projectId,
  });
}

export function useUserAssignments(userId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...ASSIGNMENTS_KEY, 'user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          *,
          project:projects(id, client_name, start_date, end_date),
          excluded_dates:assignment_excluded_dates(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as ProjectAssignment[];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!userId,
  });
}

export function useCalendarData(
  startDate: Date,
  endDate: Date,
  filters?: { projectId?: string; userId?: string }
) {
  // Format dates safely
  const startStr = startDate instanceof Date && !isNaN(startDate.getTime())
    ? startDate.toISOString().split('T')[0]
    : null;
  const endStr = endDate instanceof Date && !isNaN(endDate.getTime())
    ? endDate.toISOString().split('T')[0]
    : null;

  return useQuery({
    queryKey: [
      ...CALENDAR_KEY,
      startStr,
      endStr,
      filters?.projectId,
      filters?.userId,
    ],
    queryFn: async () => {
      if (!startStr || !endStr) {
        return [];
      }

      // Use server action for proper authentication
      const result = await getCalendarData({
        startDate: startStr,
        endDate: endStr,
        projectId: filters?.projectId,
        userId: filters?.userId,
      });

      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!startStr && !!endStr,
  });
}

export function useUserSchedule(userId: string, startDate: Date, endDate: Date) {
  const supabase = createClient();

  return useQuery({
    queryKey: [
      ...USER_SCHEDULE_KEY,
      userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_schedule', {
        p_user_id: userId,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
      });

      if (error) throw error;
      return data as UserScheduleResult[];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!userId,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ADMIN_USERS_KEY,
    queryFn: async () => {
      const result = await getAdminUsersForAssignment();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: ONE_MINUTE,
  });
}

export function useAssignment(assignmentId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...ASSIGNMENTS_KEY, assignmentId],
    queryFn: async () => {
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

      if (error) throw error;
      return data as unknown as ProjectAssignment;
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!assignmentId,
  });
}

export function useCalendarSubscriptions() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: async () => {
      const result = await getMySubscriptions();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: ONE_MINUTE,
  });
}

// ============================================
// Mutation hooks
// ============================================

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      userId: string;
      bookingStatus?: BookingStatus;
      notes?: string;
    }) => {
      const result = await createAssignment(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
    },
  });
}

export function useUpdateAssignmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      newStatus: BookingStatus;
      note?: string;
    }) => {
      const result = await updateAssignmentStatus(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
    },
  });
}

export function useRemoveAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const result = await removeAssignment(assignmentId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
    },
  });
}

export function useAddExcludedDates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      dates: string[];
      reason?: string;
    }) => {
      const result = await addExcludedDates(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
    },
  });
}

export function useRemoveExcludedDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (excludedDateId: string) => {
      const result = await removeExcludedDate(excludedDateId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
    },
  });
}

export function useBulkRemoveExcludedDates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (excludedDateIds: string[]) => {
      const result = await bulkRemoveExcludedDates(excludedDateIds);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
    },
  });
}

export function useUpdateProjectDates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      startDate: string | null;
      endDate: string | null;
    }) => {
      const result = await updateProjectDates(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useCheckConflicts() {
  return useMutation({
    mutationFn: async (data: {
      userId: string;
      startDate: string;
      endDate: string;
      excludeAssignmentId?: string;
    }) => {
      return await checkConflicts(data);
    },
  });
}

export function useOverrideConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      conflictId: string;
      reason: string;
    }) => {
      const result = await overrideConflict(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: CONFLICTS_KEY });
    },
  });
}

export function useCreateCalendarSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      feedType: 'master' | 'personal' | 'project';
      projectId?: string;
    }) => {
      const result = await createCalendarSubscription(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
    },
  });
}

export function useDeleteCalendarSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const result = await deleteCalendarSubscription(subscriptionId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
    },
  });
}

// ============================================
// Gantt / Assignment Days hooks
// ============================================

/**
 * Get users who can be assigned to projects (is_assignable = true)
 */
export function useAssignableUsers() {
  return useQuery({
    queryKey: ASSIGNABLE_USERS_KEY,
    queryFn: async () => {
      const result = await getAssignableUsers();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: ONE_MINUTE,
  });
}

/**
 * Get days for a specific assignment
 */
export function useAssignmentDays(assignmentId: string) {
  return useQuery({
    queryKey: [...ASSIGNMENT_DAYS_KEY, assignmentId],
    queryFn: async () => {
      const result = await getAssignmentDays(assignmentId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!assignmentId,
  });
}

/**
 * Get Gantt-formatted data for a project
 */
export function useProjectGanttData(projectId: string) {
  return useQuery({
    queryKey: [...GANTT_KEY, 'project', projectId],
    queryFn: async () => {
      const result = await getProjectAssignmentsForGantt(projectId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!projectId,
  });
}

/**
 * Get Gantt data for a date range
 */
export function useGanttDataForRange(
  startDate: Date,
  endDate: Date,
  userId?: string
) {
  return useQuery({
    queryKey: [
      ...GANTT_KEY,
      'range',
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      userId,
    ],
    queryFn: async () => {
      const result = await getGanttDataForRange({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        userId,
      });
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

/**
 * Add days to an assignment
 */
export function useAddAssignmentDays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      days: { date: string; startTime: string; endTime: string }[];
    }) => {
      const result = await addAssignmentDays(data);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: ASSIGNMENT_DAYS_KEY });
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
    },
  });
}

/**
 * Update times for a specific day
 */
export function useUpdateAssignmentDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      dayId: string;
      startTime: string;
      endTime: string;
    }) => {
      const result = await updateAssignmentDay(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: ASSIGNMENT_DAYS_KEY });
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
    },
  });
}

/**
 * Remove specific days from an assignment
 */
export function useRemoveAssignmentDays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dayIds: string[]) => {
      const result = await removeAssignmentDays(dayIds);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: ASSIGNMENT_DAYS_KEY });
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
    },
  });
}

/**
 * Cycle assignment status (click-to-toggle)
 * pencil → pending_confirm → confirmed → pencil
 */
export function useCycleAssignmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const result = await cycleAssignmentStatus(assignmentId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: USER_SCHEDULE_KEY });
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
    },
  });
}

/**
 * Update a user's assignable status
 */
export function useUpdateUserAssignable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      isAssignable: boolean;
    }) => {
      const result = await updateUserAssignable(data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNABLE_USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

// ============================================
// Conflict Management hooks
// ============================================

/**
 * Get unresolved booking conflicts
 */
export function useUnresolvedConflicts(userId?: string) {
  return useQuery({
    queryKey: [...CONFLICTS_KEY, 'unresolved', userId],
    queryFn: async () => {
      const result = await getUnresolvedConflicts(userId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}
