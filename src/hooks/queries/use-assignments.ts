import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  ProjectAssignment,
  BookingStatus,
  CalendarAssignmentResult,
  UserScheduleResult,
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
} from '@/app/(dashboard)/calendar/actions';

// Query keys
export const ASSIGNMENTS_KEY = ['assignments'];
export const CALENDAR_KEY = ['calendar'];
export const USER_SCHEDULE_KEY = ['userSchedule'];
export const ADMIN_USERS_KEY = ['adminUsers'];
export const SUBSCRIPTIONS_KEY = ['calendarSubscriptions'];

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
  const supabase = createClient();

  return useQuery({
    queryKey: [
      ...CALENDAR_KEY,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      filters?.projectId,
      filters?.userId,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_calendar_assignments', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
        p_project_id: filters?.projectId || null,
      });

      if (error) throw error;

      let result = data as CalendarAssignmentResult[];

      // Filter by user if specified
      if (filters?.userId) {
        result = result.filter(a => a.user_id === filters.userId);
      }

      return result;
    },
    staleTime: THIRTY_SECONDS,
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
