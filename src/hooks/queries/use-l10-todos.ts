import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTodos,
  createTodo,
  updateTodo,
  toggleTodo,
  deleteTodo,
  getMyTodos,
  getOverdueTodoCount,
  convertTodoToIssue,
} from '@/app/(dashboard)/l10/todos-actions';

export const L10_TODOS_KEY = ['l10', 'todos'];

const THIRTY_SECONDS = 30 * 1000;

export function useTodos(teamId: string | null, showDone = false) {
  return useQuery({
    queryKey: [...L10_TODOS_KEY, teamId, showDone],
    queryFn: async () => {
      if (!teamId) return [];
      const result = await getTodos(teamId, showDone);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!teamId,
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      teamId: string;
      title: string;
      ownerId?: string;
      dueDate?: string;
      sourceMeetingId?: string;
      sourceIssueId?: string;
    }) => {
      const result = await createTodo(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
    },
  });
}

export function useToggleTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await toggleTodo(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      description?: string | null;
      ownerId?: string | null;
      dueDate?: string | null;
      isDone?: boolean;
    }) => {
      const result = await updateTodo(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTodo(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
    },
  });
}

export function useMyTodos(userId: string | null, teamId?: string) {
  return useQuery({
    queryKey: [...L10_TODOS_KEY, 'my', userId, teamId],
    queryFn: async () => {
      if (!userId) return [];
      const result = await getMyTodos(userId, teamId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!userId,
  });
}

export function useOverdueTodoCount(userId: string | null) {
  return useQuery({
    queryKey: [...L10_TODOS_KEY, 'overdue-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const result = await getOverdueTodoCount(userId);
      if (!result.success) throw new Error(result.error);
      return result.data || 0;
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!userId,
  });
}

const L10_ISSUES_KEY = ['l10', 'issues'];

export function useConvertTodoToIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (todoId: string) => {
      const result = await convertTodoToIssue({ todoId });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_TODOS_KEY });
      queryClient.invalidateQueries({ queryKey: L10_ISSUES_KEY });
    },
  });
}
