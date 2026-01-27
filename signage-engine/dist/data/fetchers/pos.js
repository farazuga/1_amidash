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
    const hour = 3600000;
    const day = 86400000;
    return [
        // Top 3 largest (last 10 days)
        { id: '1', po_number: 'PO-2024-001', project_name: 'Website Redesign', client_name: 'Acme Corp', amount: 15000, created_at: new Date(now.getTime() - hour).toISOString() },
        { id: '2', po_number: 'PO-2024-002', project_name: 'Mobile App', client_name: 'TechStart', amount: 25000, created_at: new Date(now.getTime() - hour * 2).toISOString() },
        { id: '3', po_number: 'PO-2024-003', project_name: 'Brand Identity', client_name: 'NewCo', amount: 8000, created_at: new Date(now.getTime() - day).toISOString() },
        // Recent others (last 7 days)
        { id: '4', po_number: 'PO-2024-004', project_name: 'E-commerce Platform', client_name: 'RetailMax', amount: 6500, created_at: new Date(now.getTime() - day * 2).toISOString() },
        { id: '5', po_number: 'PO-2024-005', project_name: 'Dashboard Analytics', client_name: 'DataSync', amount: 4200, created_at: new Date(now.getTime() - day * 2.5).toISOString() },
        { id: '6', po_number: 'PO-2024-006', project_name: 'API Integration', client_name: 'CloudFirst', amount: 5800, created_at: new Date(now.getTime() - day * 3).toISOString() },
        { id: '7', po_number: 'PO-2024-007', project_name: 'Security Audit', client_name: 'FinServ Pro', amount: 7200, created_at: new Date(now.getTime() - day * 3.5).toISOString() },
        { id: '8', po_number: 'PO-2024-008', project_name: 'CRM Module', client_name: 'SalesForce Inc', amount: 3900, created_at: new Date(now.getTime() - day * 4).toISOString() },
        { id: '9', po_number: 'PO-2024-009', project_name: 'Mobile Checkout', client_name: 'PayEasy', amount: 4500, created_at: new Date(now.getTime() - day * 5).toISOString() },
        { id: '10', po_number: 'PO-2024-010', project_name: 'Inventory System', client_name: 'WareHouse Co', amount: 5100, created_at: new Date(now.getTime() - day * 5.5).toISOString() },
        { id: '11', po_number: 'PO-2024-011', project_name: 'Email Marketing', client_name: 'MarketPro', amount: 2800, created_at: new Date(now.getTime() - day * 6).toISOString() },
        { id: '12', po_number: 'PO-2024-012', project_name: 'Support Portal', client_name: 'HelpDesk Inc', amount: 3400, created_at: new Date(now.getTime() - day * 6.5).toISOString() },
    ];
}
//# sourceMappingURL=pos.js.map