import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRocks,
  createRock,
  updateRock,
  deleteRock,
  toggleRockStatus,
  dropRockToIssue,
  archiveRock,
  getRockTodos,
} from '@/app/(dashboard)/l10/rocks-actions';

export const L10_ROCKS_KEY = ['l10', 'rocks'];
const L10_ISSUES_KEY = ['l10', 'issues'];

const THIRTY_SECONDS = 30 * 1000;

export function useRocks(teamId: string | null, quarter?: string, showArchived = false) {
  return useQuery({
    queryKey: [...L10_ROCKS_KEY, teamId, quarter, showArchived],
    queryFn: async () => {
      if (!teamId) return [];
      const result = await getRocks(teamId, quarter, showArchived);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!teamId,
  });
}

export function useCreateRock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      teamId: string;
      title: string;
      description?: string;
      ownerId?: string;
      quarter: string;
      dueDate?: string;
    }) => {
      const result = await createRock(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useUpdateRock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      description?: string | null;
      ownerId?: string | null;
      status?: string;
      dueDate?: string | null;
      isArchived?: boolean;
    }) => {
      const result = await updateRock(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useDeleteRock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteRock(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useToggleRockStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await toggleRockStatus(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

export function useDropRockToIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rockId: string) => {
      const result = await dropRockToIssue(rockId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
    },
  });
}

export function useArchiveRock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await archiveRock(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ROCKS_KEY });
    },
  });
}

const L10_TODOS_KEY = ['l10', 'todos'];

export function useRockTodos(rockId: string | null) {
  return useQuery({
    queryKey: [...L10_TODOS_KEY, 'rock', rockId],
    queryFn: async () => {
      if (!rockId) return [];
      const result = await getRockTodos(rockId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!rockId,
  });
}
