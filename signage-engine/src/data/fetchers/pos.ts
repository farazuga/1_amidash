import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import type { DbProject } from '../types/database.js';

/** @deprecated Use HighlightPO instead */
export interface RecentPO {
  id: string;
  po_number: string;
  project_name: string;
  client_name: string;
  amount: number;
  created_at: string;
}

export interface HighlightPO {
  id: string;
  po_number: string;
  project_name: string;
  client_name: string;
  amount: number;
  created_at: string;
  highlight_reason: 'largest' | 'newest';
}

/**
 * Fetch "2 largest POs this month + 2 newest POs this month" (4 total, deduped).
 * Returns largest first, then newest.
 */
export async function fetchPOs(): Promise<HighlightPO[]> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock POs');
    return getMockHighlightPOs();
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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
      .gte('created_at', startOfMonth)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const allPOs = (data || []).map((p) => {
      const project = p as unknown as DbProject;
      return {
        id: project.id || '',
        po_number: project.po_number || '',
        project_name: project.client_name || 'Unknown Project',
        client_name: project.client_name || 'Unknown',
        amount: Math.max(0, project.sales_amount || 0),
        created_at: project.created_at || new Date().toISOString(),
      };
    });

    return selectHighlightPOs(allPOs);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch POs, returning mock data');
    return getMockHighlightPOs();
  }
}

/** @deprecated Use fetchPOs() instead */
export async function fetchRecentPOs(): Promise<RecentPO[]> {
  const highlights = await fetchPOs();
  // Strip highlight_reason for backward compat
  return highlights.map(({ highlight_reason: _, ...rest }) => rest);
}

/**
 * Given a list of POs (already sorted by created_at DESC),
 * pick 2 newest + 2 largest (deduped), return up to 4.
 */
function selectHighlightPOs(
  allPOs: Omit<HighlightPO, 'highlight_reason'>[]
): HighlightPO[] {
  if (allPOs.length === 0) return [];

  // 2 newest = first 2 (already sorted by created_at DESC)
  const newest = allPOs.slice(0, 2);
  const newestIds = new Set(newest.map((p) => p.id));

  // From remaining, sort by amount DESC, take 2 largest
  const remaining = allPOs.filter((p) => !newestIds.has(p.id));
  const sortedByAmount = [...remaining].sort((a, b) => b.amount - a.amount);
  const largest = sortedByAmount.slice(0, 2);

  // If fewer than 2 largest from remaining, fill from what's left
  if (largest.length < 2) {
    const usedIds = new Set([...newestIds, ...largest.map((p) => p.id)]);
    const filler = remaining.filter((p) => !usedIds.has(p.id));
    while (largest.length < 2 && filler.length > 0) {
      largest.push(filler.shift()!);
    }
  }

  // Return largest first, then newest
  const result: HighlightPO[] = [
    ...largest.map((p) => ({ ...p, highlight_reason: 'largest' as const })),
    ...newest.map((p) => ({ ...p, highlight_reason: 'newest' as const })),
  ];

  return result;
}

function getMockHighlightPOs(): HighlightPO[] {
  const now = new Date();
  const hour = 3600000;
  const day = 86400000;

  const allPOs = [
    { id: '1', po_number: 'PO-2024-001', project_name: 'Website Redesign', client_name: 'Acme Corp', amount: 15000, created_at: new Date(now.getTime() - hour).toISOString() },
    { id: '2', po_number: 'PO-2024-002', project_name: 'Mobile App', client_name: 'TechStart', amount: 25000, created_at: new Date(now.getTime() - hour * 2).toISOString() },
    { id: '3', po_number: 'PO-2024-003', project_name: 'Brand Identity', client_name: 'NewCo', amount: 8000, created_at: new Date(now.getTime() - day).toISOString() },
    { id: '4', po_number: 'PO-2024-004', project_name: 'E-commerce Platform', client_name: 'RetailMax', amount: 6500, created_at: new Date(now.getTime() - day * 2).toISOString() },
    { id: '5', po_number: 'PO-2024-005', project_name: 'Dashboard Analytics', client_name: 'DataSync', amount: 4200, created_at: new Date(now.getTime() - day * 2.5).toISOString() },
    { id: '6', po_number: 'PO-2024-006', project_name: 'API Integration', client_name: 'CloudFirst', amount: 5800, created_at: new Date(now.getTime() - day * 3).toISOString() },
  ];

  return selectHighlightPOs(allPOs);
}
