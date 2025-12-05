import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Status, ProjectType } from '@/types';

const STATUSES_KEY = ['statuses'];
const PROJECT_TYPES_KEY = ['projectTypes'];
const STATUS_MAP_KEY = ['statusMap'];

export interface ProjectTypeStatusMap {
  [projectTypeId: string]: string[];
}

export function useStatuses() {
  const supabase = createClient();

  return useQuery({
    queryKey: STATUSES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('statuses')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as Status[];
    },
  });
}

export function useCreateStatus() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; require_note: boolean; display_order: number }) => {
      const { data: status, error } = await supabase
        .from('statuses')
        .insert({ ...data, is_active: true })
        .select()
        .single();

      if (error) throw error;
      return status as Status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUSES_KEY });
    },
  });
}

export function useUpdateStatus() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Status> }) => {
      const { error } = await supabase
        .from('statuses')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUSES_KEY });
    },
  });
}

export function useReorderStatuses() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('statuses')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUSES_KEY });
    },
  });
}

export function useProjectTypes() {
  const supabase = createClient();

  return useQuery({
    queryKey: PROJECT_TYPES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_types')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as ProjectType[];
    },
  });
}

export function useCreateProjectType() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; display_order: number }) => {
      const { data: type, error } = await supabase
        .from('project_types')
        .insert({ ...data, is_active: true })
        .select()
        .single();

      if (error) throw error;
      return type as ProjectType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_TYPES_KEY });
    },
  });
}

export function useUpdateProjectType() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectType> }) => {
      const { error } = await supabase
        .from('project_types')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_TYPES_KEY });
    },
  });
}

export function useReorderProjectTypes() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('project_types')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_TYPES_KEY });
    },
  });
}

export function useStatusMap() {
  const supabase = createClient();

  return useQuery({
    queryKey: STATUS_MAP_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_type_statuses')
        .select('*');

      if (error) throw error;

      const map: ProjectTypeStatusMap = {};
      (data || []).forEach((row: { project_type_id: string; status_id: string }) => {
        if (!map[row.project_type_id]) {
          map[row.project_type_id] = [];
        }
        map[row.project_type_id].push(row.status_id);
      });

      return map;
    },
  });
}

export function useToggleStatusForType() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectTypeId,
      statusId,
      isEnabled,
    }: {
      projectTypeId: string;
      statusId: string;
      isEnabled: boolean;
    }) => {
      if (isEnabled) {
        const { error } = await supabase
          .from('project_type_statuses')
          .delete()
          .eq('project_type_id', projectTypeId)
          .eq('status_id', statusId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_type_statuses')
          .insert({ project_type_id: projectTypeId, status_id: statusId });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_MAP_KEY });
    },
  });
}
