import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export interface RecentPO {
  id: string;
  po_number: string;
  project_name: string;
  client_name: string;
  amount: number;
  created_at: string;
}

export async function fetchRecentPOs(): Promise<RecentPO[]> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock POs');
    return getMockPOs();
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        po_number,
        name,
        clients(name),
        total_value,
        created_at
      `)
      .not('po_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) throw error;

    return (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      po_number: p.po_number as string,
      project_name: p.name as string,
      client_name: (p.clients as { name: string } | null)?.name || 'Unknown',
      amount: (p.total_value as number) || 0,
      created_at: p.created_at as string,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch recent POs');
    return [];
  }
}

function getMockPOs(): RecentPO[] {
  const now = new Date();
  return [
    { id: '1', po_number: 'PO-2024-001', project_name: 'Website Redesign', client_name: 'Acme Corp', amount: 15000, created_at: new Date(now.getTime() - 3600000).toISOString() },
    { id: '2', po_number: 'PO-2024-002', project_name: 'Mobile App', client_name: 'TechStart', amount: 25000, created_at: new Date(now.getTime() - 7200000).toISOString() },
    { id: '3', po_number: 'PO-2024-003', project_name: 'Brand Identity', client_name: 'NewCo', amount: 8000, created_at: new Date(now.getTime() - 86400000).toISOString() },
  ];
}
