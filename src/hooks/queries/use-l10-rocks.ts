import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRocks,
  createRock,
  updateRock,
  deleteRock,
  toggleRockStatus,
  dropRockToIssue,
} from '@/app/(dashboard)/l10/rocks-actions';

export const L10_ROCKS_KEY = ['l10', 'rocks'];
const L10_ISSUES_KEY = ['l10', 'issues'];

const THIRTY_SECONDS = 30 * 1000;

export function useRocks(teamId: string | null, quarter?: string) {
  return useQuery({
    queryKey: [...L10_ROCKS_KEY, teamId, quarter],
    queryFn: async () => {
      if (!teamId) return [];
      const result = await getRocks(teamId, quarter);
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
      ownerId?: string;
      quarter: string;
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
      ownerId?: string | null;
      status?: string;
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
