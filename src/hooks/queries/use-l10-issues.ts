import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  reorderIssues,
  solveIssue,
  getIssueTodos,
} from '@/app/(dashboard)/l10/issues-actions';

export const L10_ISSUES_KEY = ['l10', 'issues'];
const L10_TODOS_KEY = ['l10', 'todos'];

const THIRTY_SECONDS = 30 * 1000;

export function useIssues(teamId: string | null, status?: string) {
  return useQuery({
    queryKey: [...L10_ISSUES_KEY, teamId, status],
    queryFn: async () => {
      if (!teamId) return [];
      const result = await getIssues(teamId, status);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!teamId,
  });
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      teamId: string;
      title: string;
      description?: string;
      sourceType?: string;
      sourceId?: string;
      sourceMeta?: Record<string, string>;
    }) => {
      const result = await createIssue(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      description?: string | null;
      status?: string;
    }) => {
      const result = await updateIssue(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
    },
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteIssue(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
    },
  });
}

export function useReorderIssues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; priority_rank: number }[]) => {
      const result = await reorderIssues(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
    },
  });
}

export function useSolveIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      todoTitle?: string;
      todoOwnerId?: string;
    }) => {
      const result = await solveIssue(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
    },
  });
}

export function useIssueTodos(issueId: string | null) {
  return useQuery({
    queryKey: [...L10_TODOS_KEY, 'issue', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const result = await getIssueTodos(issueId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!issueId,
  });
}
