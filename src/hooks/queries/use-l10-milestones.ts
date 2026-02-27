import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  toggleMilestone,
  convertDueMilestones,
} from '@/app/(dashboard)/l10/milestones-actions';
import { L10_ROCKS_KEY } from './use-l10-rocks';
import { L10_TODOS_KEY } from './use-l10-todos';

export const L10_MILESTONES_KEY = ['l10', 'milestones'];

const THIRTY_SECONDS = 30 * 1000;

export function useMilestones(rockId: string | null) {
  return useQuery({
    queryKey: [...L10_MILESTONES_KEY, rockId],
    queryFn: async () => {
      if (!rockId) return [];
      const result = await getMilestones(rockId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!rockId,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      rockId: string;
      title: string;
      dueDate?: string;
      ownerId?: string;
    }) => {
      const result = await createMilestone(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      ownerId?: string | null;
      isComplete?: boolean;
    }) => {
      const result = await updateMilestone(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMilestone(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useToggleMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await toggleMilestone(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useConvertDueMilestones() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const result = await convertDueMilestones(teamId);
      if (!result.success) throw new Error(result.error);
      return result.data || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_MILESTONES_KEY });
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
    },
  });
}
