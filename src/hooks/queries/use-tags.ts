import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Tag } from '@/types';

const TAGS_KEY = ['tags'];
const FIVE_MINUTES = 5 * 60 * 1000;

export function useTags() {
  const supabase = createClient();

  return useQuery({
    queryKey: TAGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Tag[];
    },
    staleTime: FIVE_MINUTES, // Tags rarely change
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      const { data, error } = await supabase.from('tags').insert(tag).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; color?: string }) => {
      const { data, error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}
