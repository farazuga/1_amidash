import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import type { SignageProject } from '../../types/database.js';

/**
 * Fetch active projects with their current status
 */
export async function fetchActiveProjects(maxItems: number = 15): Promise<SignageProject[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        client_name,
        sales_order_number,
        po_number,
        sales_amount,
        contract_type,
        goal_completion_date,
        start_date,
        end_date,
        current_status_id,
        salesperson_id,
        created_at,
        updated_at,
        current_status:statuses(id, name, display_order, is_active),
        salesperson:profiles!projects_salesperson_id_fkey(id, full_name, email)
      `)
      .order('goal_completion_date', { ascending: true, nullsFirst: false })
      .limit(maxItems);

    if (error) {
      logger.error({ error }, 'Failed to fetch active projects');
      throw error;
    }

    logger.info({ count: data?.length || 0 }, 'Fetched active projects');
    return (data || []) as unknown as SignageProject[];
  } catch (error) {
    logger.error({ error }, 'Exception fetching active projects');
    throw error;
  }
}

/**
 * Fetch projects by status
 */
export async function fetchProjectsByStatus(statusId: string, maxItems: number = 15): Promise<SignageProject[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        client_name,
        sales_order_number,
        po_number,
        sales_amount,
        goal_completion_date,
        current_status_id,
        current_status:statuses(id, name, display_order, is_active)
      `)
      .eq('current_status_id', statusId)
      .order('goal_completion_date', { ascending: true })
      .limit(maxItems);

    if (error) {
      logger.error({ error, statusId }, 'Failed to fetch projects by status');
      throw error;
    }

    return (data || []) as unknown as SignageProject[];
  } catch (error) {
    logger.error({ error, statusId }, 'Exception fetching projects by status');
    throw error;
  }
}

/**
 * Fetch overdue projects
 */
export async function fetchOverdueProjects(maxItems: number = 10): Promise<SignageProject[]> {
  const supabase = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        client_name,
        sales_amount,
        goal_completion_date,
        current_status_id,
        current_status:statuses(id, name, display_order, is_active)
      `)
      .lt('goal_completion_date', today)
      .order('goal_completion_date', { ascending: true })
      .limit(maxItems);

    if (error) {
      logger.error({ error }, 'Failed to fetch overdue projects');
      throw error;
    }

    logger.info({ count: data?.length || 0 }, 'Fetched overdue projects');
    return (data || []) as unknown as SignageProject[];
  } catch (error) {
    logger.error({ error }, 'Exception fetching overdue projects');
    throw error;
  }
}

/**
 * Fetch all statuses for reference
 */
export async function fetchStatuses() {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('statuses')
      .select('id, name, display_order, is_active')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      logger.error({ error }, 'Failed to fetch statuses');
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error({ error }, 'Exception fetching statuses');
    throw error;
  }
}
