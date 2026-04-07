/**
 * Shared types for dashboard metric computations.
 *
 * These types are intentionally loose so the library can be consumed by
 * different callers (dashboard, reports, API routes) without coupling to
 * a single Supabase query shape.
 */

// ---------------------------------------------------------------------------
// Period types
// ---------------------------------------------------------------------------

export type PeriodType = 'week' | 'month' | 'quarter' | 'ytd' | 'last12' | 'custom';

export interface PeriodParams {
  periodType: PeriodType;
  selectedYear: number;
  selectedMonth: number;
  selectedQuarter: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ---------------------------------------------------------------------------
// Minimal project shape expected by compute helpers
// ---------------------------------------------------------------------------

export interface MetricProject {
  id: string;
  sales_amount: number | null;
  current_status_id: string | null;
  created_date: string | null;
  invoiced_date: string | null;
  client_name?: string;
}

// ---------------------------------------------------------------------------
// Minimal status-history shape expected by compute helpers
// ---------------------------------------------------------------------------

export interface MetricStatusHistoryItem {
  project_id: string;
  changed_at: string;
  status: { name: string } | null;
}

// ---------------------------------------------------------------------------
// Revenue goal shape
// ---------------------------------------------------------------------------

export interface MetricRevenueGoal {
  year: number;
  month: number;
  revenue_goal: number;
  invoiced_revenue_goal: number;
}

// ---------------------------------------------------------------------------
// Computed goal result
// ---------------------------------------------------------------------------

export interface PeriodGoals {
  revenue: number;
  invoicedRevenue: number;
}

// ---------------------------------------------------------------------------
// Excluded status IDs helper
// ---------------------------------------------------------------------------

export interface ExcludedStatusIds {
  invoicedStatusId?: string;
  cancelledStatusId?: string;
}
