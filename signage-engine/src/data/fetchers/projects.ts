import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export interface ActiveProject {
  id: string;
  name: string;
  client_name: string;
  status: string;
  status_color: string;
  start_date: string | null;
  due_date: string | null;
  total_value: number;
}

export async function fetchActiveProjects(): Promise<ActiveProject[]> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock projects');
    return getMockProjects();
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        clients(name),
        statuses(name, color),
        start_date,
        due_date,
        total_value
      `)
      .not('statuses.name', 'ilike', '%complete%')
      .not('statuses.name', 'ilike', '%cancelled%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: p.name as string,
      client_name: (p.clients as { name: string } | null)?.name || 'Unknown',
      status: (p.statuses as { name: string } | null)?.name || 'Unknown',
      status_color: (p.statuses as { color: string } | null)?.color || '#808080',
      start_date: p.start_date as string | null,
      due_date: p.due_date as string | null,
      total_value: (p.total_value as number) || 0,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch active projects');
    return [];
  }
}

function getMockProjects(): ActiveProject[] {
  return [
    { id: '1', name: 'Project Alpha', client_name: 'Client A', status: 'In Progress', status_color: '#3b82f6', start_date: '2024-01-01', due_date: '2024-06-01', total_value: 50000 },
    { id: '2', name: 'Project Beta', client_name: 'Client B', status: 'Review', status_color: '#f59e0b', start_date: '2024-02-01', due_date: '2024-05-01', total_value: 35000 },
    { id: '3', name: 'Project Gamma', client_name: 'Client C', status: 'Design', status_color: '#8b5cf6', start_date: '2024-03-01', due_date: '2024-07-01', total_value: 75000 },
  ];
}
