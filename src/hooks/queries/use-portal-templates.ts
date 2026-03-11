import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { PortalTemplate, PortalBlock } from '@/types';

const PORTAL_TEMPLATES_KEY = ['portalTemplates'];
const PROJECT_TYPES_KEY = ['projectTypes'];

const TEN_MINUTES = 10 * 60 * 1000;

// Note: portal_templates table and portal_template_id column are added by migration 048.
// Supabase generated types won't include them until types are regenerated after migration.
// Using `as any` casts until then (same pattern as increment_portal_views RPC).

export function usePortalTemplates() {
  const supabase = createClient();

  return useQuery({
    queryKey: PORTAL_TEMPLATES_KEY,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('portal_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as PortalTemplate[];
    },
    staleTime: TEN_MINUTES,
  });
}

export function useCreatePortalTemplate() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (template: { name: string; blocks: PortalBlock[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('portal_templates')
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data as PortalTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PORTAL_TEMPLATES_KEY });
    },
  });
}

export function useUpdatePortalTemplate() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      blocks?: PortalBlock[];
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('portal_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PORTAL_TEMPLATES_KEY });
    },
  });
}

export function useDeletePortalTemplate() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('portal_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PORTAL_TEMPLATES_KEY });
    },
  });
}

export function useAssignTemplateToType() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      projectTypeId,
      templateId,
    }: {
      projectTypeId: string;
      templateId: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('project_types')
        .update({ portal_template_id: templateId })
        .eq('id', projectTypeId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_TYPES_KEY });
      queryClient.invalidateQueries({ queryKey: PORTAL_TEMPLATES_KEY });
    },
  });
}
