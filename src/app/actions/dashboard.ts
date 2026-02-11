'use server';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_THRESHOLDS } from '@/lib/dashboard-thresholds';
import type { DashboardThresholds } from '@/lib/dashboard-thresholds';

export interface DashboardProject {
  id: string;
  client_name: string;
  sales_order_number: string | null;
  sales_amount: number | null;
  goal_completion_date: string | null;
  current_status_id: string | null;
  created_at: string | null;
  created_date: string | null; // User-editable PO received date (use this for PO date calculations)
  invoiced_date: string | null;
  number_of_vidpods: number | null;
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
  project?: { id: string; client_name: string; sales_order_number: string | null; sales_amount: number | null } | null;
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
  thresholds: DashboardThresholds;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [projectsRes, statusesRes, historyRes, goalsRes, settingsRes] = await Promise.all([
    supabase.from('projects').select(`*, current_status:statuses(*)`),
    supabase.from('statuses').select('*').order('display_order'),
    supabase.from('status_history').select(`*, status:statuses(*), project:projects(id, client_name, sales_order_number, sales_amount)`).order('changed_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('revenue_goals').select('*'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)('app_settings').select('*').like('key', 'dashboard_%'),
  ]);

  // Parse threshold settings
  const thresholds = { ...DEFAULT_THRESHOLDS };
  const settingKeyMap: Record<string, keyof DashboardThresholds> = {
    'dashboard_wip_aging_days': 'wipAgingDays',
    'dashboard_sales_health_threshold': 'salesHealthThreshold',
    'dashboard_operations_health_threshold': 'operationsHealthThreshold',
    'dashboard_ontime_good_threshold': 'ontimeGoodThreshold',
    'dashboard_ontime_warning_threshold': 'ontimeWarningThreshold',
    'dashboard_concentration_high_threshold': 'concentrationHighThreshold',
    'dashboard_concentration_medium_threshold': 'concentrationMediumThreshold',
    'dashboard_backlog_warning_months': 'backlogWarningMonths',
    'dashboard_not_scheduled_warning_days': 'notScheduledWarningDays',
    'dashboard_low_invoice_warning_percent': 'lowInvoiceWarningPercent',
    'dashboard_signage_min_project_value': 'signageMinProjectValue',
    'dashboard_signage_upcoming_days': 'signageUpcomingDays',
  };

  if (settingsRes.data) {
    settingsRes.data.forEach((setting: { key: string; value: number | string }) => {
      const key = settingKeyMap[setting.key];
      if (key) {
        thresholds[key] = typeof setting.value === 'number'
          ? setting.value
          : Number(setting.value) || DEFAULT_THRESHOLDS[key];
      }
    });
  }

  return {
    projects: (projectsRes.data || []) as DashboardProject[],
    statuses: (statusesRes.data || []) as DashboardStatus[],
    statusHistory: (historyRes.data || []) as DashboardStatusHistoryItem[],
    goals: (goalsRes.data || []) as DashboardRevenueGoal[],
    thresholds,
  };
}
