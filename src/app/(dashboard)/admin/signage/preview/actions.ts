'use server';

import { createClient } from '@/lib/supabase/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export interface PreviewActiveProject {
  id: string;
  name: string;
  client_name: string;
  status: string;
  total_value: number;
}

export interface PreviewInvoicedProject {
  id: string;
  name: string;
  client_name: string;
  total_value: number;
  completed_at: string;
}

export interface PreviewHighlightPO {
  id: string;
  po_number: string;
  project_name: string;
  client_name: string;
  amount: number;
  created_at: string;
  highlight_reason: 'largest' | 'newest';
}

export interface PreviewRevenueData {
  activeProjectCount: number;
  invoicedThisMonthCount: number;
  salesThisMonth: number;
  quarterPct: number;
  quarterRevenue: number;
  quarterGoal: number;
}

export interface PreviewData {
  activeProjects: PreviewActiveProject[];
  invoicedProjects: PreviewInvoicedProject[];
  highlightPOs: PreviewHighlightPO[];
  revenue: PreviewRevenueData;
}

function selectHighlightPOs(
  allPOs: Omit<PreviewHighlightPO, 'highlight_reason'>[]
): PreviewHighlightPO[] {
  if (allPOs.length === 0) return [];

  // 2 newest = first 2 (already sorted by created_at DESC)
  const newest = allPOs.slice(0, 2);
  const newestIds = new Set(newest.map((p) => p.id));

  // From remaining, sort by amount DESC, take 2 largest
  const remaining = allPOs.filter((p) => !newestIds.has(p.id));
  const sortedByAmount = [...remaining].sort((a, b) => b.amount - a.amount);
  const largest = sortedByAmount.slice(0, 2);

  const result: PreviewHighlightPO[] = [
    ...largest.map((p) => ({ ...p, highlight_reason: 'largest' as const })),
    ...newest.map((p) => ({ ...p, highlight_reason: 'newest' as const })),
  ];

  return result;
}

export async function getPreviewData(): Promise<PreviewData> {
  const supabase: AnySupabase = await createClient();

  // Fetch active projects: exclude completed/cancelled/invoiced statuses
  const { data: excludeStatuses } = await supabase
    .from('statuses')
    .select('id')
    .in('name', ['Invoiced', 'Cancelled']);

  const excludeIds = (excludeStatuses || []).map((s: { id: string }) => s.id);

  const projectsQuery = supabase
    .from('projects')
    .select('id, client_name, sales_amount, statuses:current_status_id(id, name)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (excludeIds.length > 0) {
    projectsQuery.not('current_status_id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data: activeProjectsRaw } = await projectsQuery;

  const activeProjects: PreviewActiveProject[] = (activeProjectsRaw || []).map(
    (p: { id: string; client_name: string; sales_amount: number; statuses?: { name: string } }) => ({
      id: p.id,
      name: p.client_name,
      client_name: p.client_name,
      status: p.statuses?.name || 'Unknown',
      total_value: p.sales_amount || 0,
    })
  );

  // Fetch invoiced projects
  const { data: invoicedStatuses } = await supabase
    .from('statuses')
    .select('id')
    .eq('name', 'Invoiced');

  const invoicedStatusIds = (invoicedStatuses || []).map((s: { id: string }) => s.id);

  let invoicedProjects: PreviewInvoicedProject[] = [];
  if (invoicedStatusIds.length > 0) {
    const { data: invoicedRaw } = await supabase
      .from('projects')
      .select('id, client_name, sales_amount, invoiced_date')
      .in('current_status_id', invoicedStatusIds)
      .order('invoiced_date', { ascending: false })
      .limit(4);

    invoicedProjects = (invoicedRaw || []).map(
      (p: { id: string; client_name: string; sales_amount: number; invoiced_date: string }) => ({
        id: p.id,
        name: p.client_name,
        client_name: p.client_name,
        total_value: p.sales_amount || 0,
        completed_at: p.invoiced_date || new Date().toISOString(),
      })
    );
  }

  // Fetch POs this month (from projects with po_number set)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: posRaw } = await supabase
    .from('projects')
    .select('id, po_number, client_name, sales_amount, created_date')
    .not('po_number', 'is', null)
    .gte('created_date', startOfMonth)
    .order('created_date', { ascending: false });

  const allPOsFlat = (posRaw || []).map(
    (p: { id: string; po_number: string; client_name: string; sales_amount: number; created_date: string }) => ({
      id: p.id,
      po_number: p.po_number || '',
      project_name: p.client_name || 'Unknown',
      client_name: p.client_name || 'Unknown',
      amount: Math.max(0, p.sales_amount || 0),
      created_at: p.created_date || new Date().toISOString(),
    })
  );

  const highlightPOs = selectHighlightPOs(allPOsFlat);

  // Revenue data: current month and quarter from invoiced projects
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
  const quarterEnd = quarterStart + 2;

  const startOfYear = new Date(currentYear, 0, 1).toISOString();
  const startOfQuarter = new Date(currentYear, quarterStart - 1, 1).toISOString();

  // Revenue goals
  const { data: goals } = await supabase
    .from('revenue_goals')
    .select('month, revenue_goal')
    .eq('year', currentYear);

  const monthlyGoals = new Map<number, number>();
  (goals || []).forEach((g: { month: number; revenue_goal: number }) => {
    monthlyGoals.set(g.month, g.revenue_goal);
  });

  // Invoiced this month: count from invoiced projects updated this month
  const startOfMonthDate = new Date(currentYear, currentMonth - 1, 1).toISOString();
  const endOfMonthDate = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

  let invoicedThisMonthCount = 0;
  let salesThisMonth = 0;
  if (invoicedStatusIds.length > 0) {
    const { data: thisMonthInvoiced } = await supabase
      .from('projects')
      .select('id, sales_amount')
      .in('current_status_id', invoicedStatusIds)
      .gte('invoiced_date', startOfMonthDate)
      .lte('invoiced_date', endOfMonthDate);

    invoicedThisMonthCount = (thisMonthInvoiced || []).length;
    salesThisMonth = (thisMonthInvoiced || []).reduce(
      (sum: number, p: { sales_amount: number }) => sum + (p.sales_amount || 0),
      0
    );
  }

  // Quarter revenue: sum invoiced projects updated in current quarter
  const startOfQuarterDate = new Date(currentYear, quarterStart - 1, 1).toISOString();
  const endOfQuarterDate = new Date(currentYear, quarterEnd, 0, 23, 59, 59).toISOString();

  let quarterRevenue = 0;
  if (invoicedStatusIds.length > 0) {
    const { data: quarterInvoiced } = await supabase
      .from('projects')
      .select('sales_amount')
      .in('current_status_id', invoicedStatusIds)
      .gte('invoiced_date', startOfQuarterDate)
      .lte('invoiced_date', endOfQuarterDate);

    quarterRevenue = (quarterInvoiced || []).reduce(
      (sum: number, p: { sales_amount: number }) => sum + (p.sales_amount || 0),
      0
    );
  }

  let quarterGoal = 0;
  for (let m = quarterStart; m <= quarterEnd; m++) {
    quarterGoal += monthlyGoals.get(m) || 0;
  }

  const quarterPct = quarterGoal > 0 ? (quarterRevenue / quarterGoal) * 100 : 0;

  // Suppress unused variable warnings — variables referenced for future use
  void startOfYear;
  void startOfQuarter;

  return {
    activeProjects,
    invoicedProjects,
    highlightPOs,
    revenue: {
      activeProjectCount: activeProjects.length,
      invoicedThisMonthCount,
      salesThisMonth,
      quarterPct,
      quarterRevenue,
      quarterGoal,
    },
  };
}
