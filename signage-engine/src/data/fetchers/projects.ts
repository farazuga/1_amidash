import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

// Generate a color based on status name
function getStatusColor(statusName: string): string {
  const name = statusName.toLowerCase();
  if (name.includes('complete')) return '#10b981'; // green
  if (name.includes('progress') || name.includes('active')) return '#3b82f6'; // blue
  if (name.includes('review') || name.includes('waiting')) return '#f59e0b'; // amber
  if (name.includes('pending') || name.includes('hold')) return '#6b7280'; // gray
  if (name.includes('cancel')) return '#ef4444'; // red
  if (name.includes('design') || name.includes('planning')) return '#8b5cf6'; // purple
  if (name.includes('test') || name.includes('qa')) return '#06b6d4'; // cyan
  return '#6b7280'; // default gray
}

export interface ActiveProject {
  id: string;
  name: string;
  client_name: string;
  status: string;
  status_color: string;
  project_type: string | null;
  salesperson: string | null;
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
    // First get completed/cancelled status IDs to filter them out
    const { data: excludeStatuses } = await supabase
      .from('statuses')
      .select('id')
      .or('name.ilike.%complete%,name.ilike.%cancelled%');

    const excludeIds = (excludeStatuses || []).map(s => s.id);

    const query = supabase
      .from('projects')
      .select(`
        id,
        client_name,
        created_date,
        goal_completion_date,
        sales_amount,
        statuses:current_status_id(id, name),
        project_types:project_type_id(name),
        salesperson:salesperson_id(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter out completed/cancelled projects
    if (excludeIds.length > 0) {
      query.not('current_status_id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((p: Record<string, unknown>) => {
      const statusName = (p.statuses as { name: string } | null)?.name || 'Unknown';
      return {
        id: p.id as string,
        name: p.client_name as string,
        client_name: p.client_name as string,
        status: statusName,
        status_color: getStatusColor(statusName),
        project_type: (p.project_types as { name: string } | null)?.name || null,
        salesperson: (p.salesperson as { full_name: string } | null)?.full_name || null,
        start_date: p.created_date as string | null,
        due_date: p.goal_completion_date as string | null,
        total_value: (p.sales_amount as number) || 0,
      };
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch active projects');
    return [];
  }
}

function getMockProjects(): ActiveProject[] {
  return [
    { id: '1', name: 'Project Alpha', client_name: 'Client A', status: 'In Progress', status_color: '#3b82f6', project_type: 'Integration', salesperson: 'John Doe', start_date: '2024-01-01', due_date: '2024-06-01', total_value: 50000 },
    { id: '2', name: 'Project Beta', client_name: 'Client B', status: 'Review', status_color: '#f59e0b', project_type: 'Custom Dev', salesperson: 'Jane Smith', start_date: '2024-02-01', due_date: '2024-05-01', total_value: 35000 },
    { id: '3', name: 'Project Gamma', client_name: 'Client C', status: 'Design', status_color: '#8b5cf6', project_type: 'Support', salesperson: 'Bob Wilson', start_date: '2024-03-01', due_date: '2024-07-01', total_value: 75000 },
    { id: '4', name: 'Project Delta', client_name: 'Client D', status: 'Testing', status_color: '#06b6d4', project_type: 'Integration', salesperson: 'Alice Brown', start_date: '2024-01-15', due_date: '2024-04-15', total_value: 42000 },
    { id: '5', name: 'Project Epsilon', client_name: 'Client E', status: 'In Progress', status_color: '#3b82f6', project_type: 'Custom Dev', salesperson: 'John Doe', start_date: '2024-02-20', due_date: '2024-08-01', total_value: 95000 },
    { id: '6', name: 'Project Zeta', client_name: 'Client F', status: 'Planning', status_color: '#8b5cf6', project_type: 'Support', salesperson: 'Jane Smith', start_date: '2024-03-10', due_date: '2024-09-01', total_value: 28000 },
  ];
}
