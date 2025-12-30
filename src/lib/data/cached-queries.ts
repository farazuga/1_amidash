import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Cached query for statuses
 * Revalidates every hour since statuses rarely change
 */
export const getCachedStatuses = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('statuses')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    return data || [];
  },
  ['statuses'],
  { revalidate: 3600, tags: ['statuses'] } // Cache for 1 hour
);

/**
 * Cached query for tags
 * Revalidates every hour since tags rarely change
 */
export const getCachedTags = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    return data || [];
  },
  ['tags'],
  { revalidate: 3600, tags: ['tags'] } // Cache for 1 hour
);

/**
 * Cached query for project types
 * Revalidates every hour since project types rarely change
 */
export const getCachedProjectTypes = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('project_types')
      .select('*')
      .order('display_order');
    return data || [];
  },
  ['project-types'],
  { revalidate: 3600, tags: ['project-types'] } // Cache for 1 hour
);

/**
 * Cached query for project type statuses mapping
 * Revalidates every hour since mappings rarely change
 */
export const getCachedProjectTypeStatuses = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('project_type_statuses')
      .select('*');
    return data || [];
  },
  ['project-type-statuses'],
  { revalidate: 3600, tags: ['project-type-statuses'] } // Cache for 1 hour
);

/**
 * Cached query for salespeople
 * Revalidates every 30 minutes since sales team changes more frequently
 */
export const getCachedSalespeople = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_salesperson', true)
      .order('full_name');
    return data || [];
  },
  ['salespeople'],
  { revalidate: 1800, tags: ['salespeople'] } // Cache for 30 minutes
);

/**
 * Non-cached query for project - projects change frequently
 */
export async function getProject(id: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*),
      tags:project_tags(tag:tags(*)),
      created_by_profile:profiles!projects_created_by_fkey(*),
      salesperson:profiles!projects_salesperson_id_fkey(*)
    `)
    .eq('id', id)
    .single();

  return project;
}

/**
 * Non-cached query for status history - specific to project and changes often
 */
export async function getStatusHistory(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('status_history')
    .select(`
      *,
      status:statuses(*),
      changed_by_profile:profiles(*)
    `)
    .eq('project_id', projectId)
    .order('changed_at', { ascending: false });
  return data || [];
}

/**
 * Non-cached query for current user - session-specific
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile;
}
