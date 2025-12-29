'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Project, Tag } from '@/types';

export interface ProjectWithDetails extends Project {
  tags?: Tag[];
  assignments?: {
    id: string;
    user_id: string;
    user: {
      id: string;
      full_name: string;
    } | null;
  }[];
}

export function useProjectsWithDates() {
  return useQuery({
    queryKey: ['projects-with-dates'],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tags:project_tags(tag:tags(*)),
          assignments:project_assignments(
            id,
            user_id,
            user:profiles!project_assignments_user_id_fkey(id, full_name)
          )
        `)
        .not('start_date', 'is', null)
        .not('end_date', 'is', null)
        .order('start_date', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      // Transform tags from nested structure
      const transformed = (data || []).map(project => ({
        ...project,
        tags: project.tags?.map((t: { tag: Tag }) => t.tag) || [],
      }));

      // Type assertion needed until Supabase types are regenerated with schedule_status
      return transformed as unknown as ProjectWithDetails[];
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get unique engineers from all projects
 */
export function useProjectEngineers() {
  return useQuery({
    queryKey: ['project-engineers'],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          user_id,
          user:profiles!project_assignments_user_id_fkey(id, full_name)
        `);

      if (error) {
        throw new Error(error.message);
      }

      // Type assertion for data with user relation
      type AssignmentWithUser = {
        user_id: string;
        user: { id: string; full_name: string } | null;
      };
      const typedData = data as unknown as AssignmentWithUser[];

      // Get unique engineers
      const engineerMap = new Map<string, { id: string; full_name: string }>();
      for (const item of typedData || []) {
        if (item.user) {
          engineerMap.set(item.user.id, item.user);
        }
      }

      return Array.from(engineerMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get all tags
 */
export function useAllTags() {
  return useQuery({
    queryKey: ['all-tags'],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Tag[];
    },
    staleTime: 60000, // 1 minute
  });
}
