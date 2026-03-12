import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '@/app/(dashboard)/l10/comments-actions';
import type { CommentEntityType } from '@/types/l10';

export const L10_COMMENTS_KEY = ['l10', 'comments'];

const THIRTY_SECONDS = 30 * 1000;

export function useComments(entityType: CommentEntityType, entityId: string | null) {
  return useQuery({
    queryKey: [...L10_COMMENTS_KEY, entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const result = await getComments(entityType, entityId);
      if (!result.success) throw new Error(result.error);
      return result.data || [];
    },
    staleTime: THIRTY_SECONDS,
    enabled: !!entityId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      entityType: CommentEntityType;
      entityId: string;
      content: string;
    }) => {
      const result = await createComment(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_COMMENTS_KEY });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; content: string }) => {
      const result = await updateComment(data);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_COMMENTS_KEY });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteComment(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: L10_COMMENTS_KEY });
    },
  });
}
