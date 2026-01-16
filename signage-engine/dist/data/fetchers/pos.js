import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
export async function fetchRecentPOs() {
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
        client_name,
        sales_amount,
        created_at
      `)
            .not('po_number', 'is', null)
            .order('created_at', { ascending: false })
            .limit(15);
        if (error)
            throw error;
        return (data || []).map((p) => ({
            id: p.id,
            po_number: p.po_number,
            project_name: p.client_name,
            client_name: p.client_name,
            amount: p.sales_amount || 0,
            created_at: p.created_at,
        }));
    }
    catch (error) {
        logger.error({ error }, 'Failed to fetch recent POs');
        return [];
    }
}
function getMockPOs() {
    const now = new Date();
    return [
        { id: '1', po_number: 'PO-2024-001', project_name: 'Website Redesign', client_name: 'Acme Corp', amount: 15000, created_at: new Date(now.getTime() - 3600000).toISOString() },
        { id: '2', po_number: 'PO-2024-002', project_name: 'Mobile App', client_name: 'TechStart', amount: 25000, created_at: new Date(now.getTime() - 7200000).toISOString() },
        { id: '3', po_number: 'PO-2024-003', project_name: 'Brand Identity', client_name: 'NewCo', amount: 8000, created_at: new Date(now.getTime() - 86400000).toISOString() },
    ];
}
//# sourceMappingURL=pos.js.map