import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Request-scoped cached query for statuses
 * Uses React's cache() for request deduplication
 */
export const getCachedStatuses = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('statuses')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  return data || [];
});

/**
 * Request-scoped cached query for tags
 */
export const getCachedTags = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tags')
    .select('*')
    .order('name');
  return data || [];
});

/**
 * Request-scoped cached query for project types
 */
export const getCachedProjectTypes = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_types')
    .select('*')
    .order('display_order');
  return data || [];
});

/**
 * Request-scoped cached query for project type statuses mapping
 */
export const getCachedProjectTypeStatuses = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_type_statuses')
    .select('*');
  return data || [];
});

/**
 * Request-scoped cached query for salespeople
 */
export const getCachedSalespeople = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_salesperson', true)
    .order('full_name');
  return data || [];
});

/**
 * Query for project - request-scoped via cache() for deduplication
 */
export const getProject = cache(async (id: string) => {
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
});

/**
 * Query for status history - request-scoped via cache() for deduplication
 */
export const getStatusHistory = cache(async (projectId: string) => {
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
});

/**
 * Query for current user - request-scoped via cache() for deduplication
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile;
});
