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
  bulkUpdateAssignmentStatus,
  removeAssignment,
  addExcludedDates,
  removeExcludedDate,
  bulkRemoveExcludedDates,
  updateProjectDates,
  checkConflicts,
  overrideConflict,
  getAdminUsersForAssignment,
  // New actions for Gantt/day management
  addAssignmentDays,
  updateAssignmentDay,
  moveAssignmentDay,
  removeAssignmentDays,
  getAssignmentDays,
  cycleAssignmentStatus,
  getAssignableUsers,
  updateUserAssignable,
  getProjectAssignments,
  getProjectAssignmentsForGantt,
  getGanttDataForRange,
  // Calendar data server action
  getCalendarData,
  getUnresolvedConflicts,
  // Availability actions
  getTeamAvailability,
  getUserAvailability,
} from '@/app/(dashboard)/calendar/actions';
import {
  createConfirmationRequest,
  getPendingConfirmations,
  resendConfirmationEmail,
  cancelConfirmationRequest,
} from '@/app/(dashboard)/calendar/confirmation-actions';
import type { UserAvailability } from '@/types/calendar';

// Query keys
export const ASSIGNMENTS_KEY = ['assignments'];
export const CALENDAR_KEY = ['calendar'];
export const USER_SCHEDULE_KEY = ['userSchedule'];
export const ADMIN_USERS_KEY = ['adminUsers'];
export const ASSIGNABLE_USERS_KEY = ['assignableUsers'];
export const ASSIGNMENT_DAYS_KEY = ['assignmentDays'];
export const GANTT_KEY = ['gantt'];
export const CONFLICTS_KEY = ['bookingConflicts'];
export const TEAM_AVAILABILITY_KEY = ['team-availability'];
export const USER_AVAILABILITY_KEY = ['user-availability'];
export const CONFIRMATION_REQUESTS_KEY = ['confirmation-requests'];

const ONE_MINUTE = 60 * 1000;
const THIRTY_SECONDS = 30 * 1000;

// ============================================
// Query hooks
// ============================================

export function useProjectAssignments(projectId: string) {
  return useQuery({
    queryKey: [...ASSIGNMENTS_KEY, 'project', projectId],
    queryFn: async () => {
      // Use server action for reliable authentication
      const result = await getProjectAssignments(projectId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
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
  filters?: { projectId?: string; userId?: string; limit?: number; offset?: number }
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
      filters?.limit,
      filters?.offset,
    ],
    queryFn: async () => {
      if (!startStr || !endStr) {
        return { data: [], total: 0, hasMore: false, scheduledDaysMap: {}, scheduledDaysWithIds: {} };
      }

      // Use server action for proper authentication
      const result = await getCalendarData({
        startDate: startStr,
        endDate: endStr,
        projectId: filters?.projectId,
        userId: filters?.userId,
        limit: filters?.limit,
        offset: filters?.offset,
      });

      if (!result.success) throw new Error(result.error);
      return result.data || { data: [], total: 0, hasMore: false, scheduledDaysMap: {}, scheduledDaysWithIds: {} };
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
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
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
      queryClient.invalidateQueries({ queryKey: CONFLICTS_KEY });
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
 * Move an assignment day to a new date
 */
export function useMoveAssignmentDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      dayId: string;
      newDate: string;
    }) => {
      const result = await moveAssignmentDay(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
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

// ============================================
// Availability Management hooks
// ============================================

/**
 * Get team availability for a date range
 */
export function useTeamAvailability(
  startDate: Date,
  endDate: Date,
  userIds?: string[]
) {
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: [...TEAM_AVAILABILITY_KEY, startStr, endStr, userIds],
    queryFn: async () => {
      const result = await getTeamAvailability({
        startDate: startStr,
        endDate: endStr,
        userIds,
      });
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

/**
 * Get availability for a specific user in a date range
 */
export function useUserAvailabilityRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: [...USER_AVAILABILITY_KEY, userId, startStr, endStr],
    queryFn: async () => {
      const result = await getUserAvailability({
        userId,
        startDate: startStr,
        endDate: endStr,
      });
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!userId,
  });
}

// ============================================
// Bulk Status Update hooks
// ============================================

/**
 * Bulk update status for multiple assignments at once
 */
export function useBulkUpdateAssignmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      assignmentIds: string[];
      newStatus: BookingStatus;
      note?: string;
    }) => {
      const result = await bulkUpdateAssignmentStatus(data);
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

// ============================================
// Confirmation Request hooks
// ============================================

/**
 * Get pending confirmation requests
 */
export function usePendingConfirmations() {
  return useQuery({
    queryKey: [...CONFIRMATION_REQUESTS_KEY, 'pending'],
    queryFn: async () => {
      const result = await getPendingConfirmations();
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
  });
}

/**
 * Create a confirmation request to send to customer
 */
export function useCreateConfirmationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      assignmentIds: string[];
      sendToEmail: string;
      sendToName?: string;
    }) => {
      const result = await createConfirmationRequest(data);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
      queryClient.invalidateQueries({ queryKey: CONFIRMATION_REQUESTS_KEY });
    },
  });
}

/**
 * Resend a confirmation email
 */
export function useResendConfirmationEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const result = await resendConfirmationEmail(requestId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIRMATION_REQUESTS_KEY });
    },
  });
}

/**
 * Cancel a pending confirmation request
 */
export function useCancelConfirmationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const result = await cancelConfirmationRequest(requestId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      queryClient.invalidateQueries({ queryKey: GANTT_KEY });
      queryClient.invalidateQueries({ queryKey: CONFIRMATION_REQUESTS_KEY });
    },
  });
}
