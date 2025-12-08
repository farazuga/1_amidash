'use server';

import { createClient } from '@/lib/supabase/server';

export interface DashboardProject {
  id: string;
  client_name: string;
  sales_amount: number | null;
  goal_completion_date: string | null;
  current_status_id: string | null;
  created_at: string | null;
  current_status: { id: string; name: string } | null;
}

export interface DashboardStatus {
  id: string;
  name: string;
  display_order: number;
}

export interface DashboardStatusHistoryItem {
  id: string;
  project_id: string;
  status_id: string;
  changed_at: string;
  status: { name: string } | null;
  project?: { id: string; client_name: string; sales_amount: number | null } | null;
}

export interface DashboardRevenueGoal {
  year: number;
  month: number;
  revenue_goal: number;
  projects_goal: number;
  invoiced_revenue_goal: number;
}

export interface DashboardData {
  projects: DashboardProject[];
  statuses: DashboardStatus[];
  statusHistory: DashboardStatusHistoryItem[];
  goals: DashboardRevenueGoal[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [projectsRes, statusesRes, historyRes, goalsRes] = await Promise.all([
    supabase.from('projects').select(`*, current_status:statuses(*)`),
    supabase.from('statuses').select('*').order('display_order'),
    supabase.from('status_history').select(`*, status:statuses(*), project:projects(id, client_name, sales_amount)`).order('changed_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('revenue_goals').select('*'),
  ]);

  return {
    projects: (projectsRes.data || []) as DashboardProject[],
    statuses: (statusesRes.data || []) as DashboardStatus[],
    statusHistory: (historyRes.data || []) as DashboardStatusHistoryItem[],
    goals: (goalsRes.data || []) as DashboardRevenueGoal[],
  };
}
