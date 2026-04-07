import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export interface RevenueData {
  currentMonthRevenue: number;
  currentMonthGoal: number;
  quarterRevenue: number;
  quarterGoal: number;
  yearToDateRevenue: number;
  yearToDateGoal: number;
  monthlyData: { month: string; revenue: number; goal: number }[];
}

/**
 * Fetch revenue data for the signage display.
 *
 * CANONICAL DEFINITIONS (see src/lib/metrics/compute.ts):
 * - Invoiced revenue: SUM(sales_amount) WHERE invoiced_date in period
 *   Uses `invoiced_date` on projects table (NOT updated_at, NOT status_history)
 * - Revenue goals: from revenue_goals.revenue_goal column (NOT "amount")
 * - Money field: projects.sales_amount (NOT total_value)
 */
export async function fetchRevenueData(): Promise<RevenueData> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock revenue');
    return getMockRevenue();
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Fetch revenue goals — uses `revenue_goal` column (NOT `amount` which doesn't exist)
    const { data: goals } = await supabase
      .from('revenue_goals')
      .select('month, revenue_goal')
      .eq('year', currentYear);

    // Fetch invoiced projects this year — uses `invoiced_date` on projects table
    // NOT status_history + changed_at (which was the previous incorrect approach)
    const { data: invoicedProjects } = await supabase
      .from('projects')
      .select('invoiced_date, sales_amount')
      .gte('invoiced_date', `${currentYear}-01-01`)
      .lte('invoiced_date', `${currentYear}-12-31`);

    // Group invoiced revenue by month using invoiced_date
    const monthlyRevenue = new Map<number, number>();
    (invoicedProjects || []).forEach((p: { invoiced_date: string; sales_amount: number }) => {
      const date = new Date(p.invoiced_date + 'T00:00:00');
      const month = date.getMonth() + 1;
      const value = p.sales_amount || 0;
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + value);
    });

    const monthlyData = [];
    let ytdRevenue = 0;
    let ytdGoal = 0;
    let quarterRevenue = 0;
    let quarterGoal = 0;

    // Current quarter: Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12
    const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
    const quarterEnd = quarterStart + 2;

    for (let m = 1; m <= 12; m++) {
      const goal = goals?.find((g: { month: number; revenue_goal: number }) => g.month === m);
      const revenue = monthlyRevenue.get(m) || 0;
      const goalAmount = goal?.revenue_goal || 0;
      if (m <= currentMonth) {
        ytdRevenue += revenue;
        ytdGoal += goalAmount;
      }
      if (m >= quarterStart && m <= quarterEnd) {
        if (m <= currentMonth) {
          quarterRevenue += revenue;
        }
        quarterGoal += goalAmount;
      }
      monthlyData.push({
        month: new Date(currentYear, m - 1).toLocaleString('default', { month: 'short' }),
        revenue,
        goal: goalAmount,
      });
    }

    return {
      currentMonthRevenue: monthlyRevenue.get(currentMonth) || 0,
      currentMonthGoal: goals?.find((g: { month: number; revenue_goal: number }) => g.month === currentMonth)?.revenue_goal || 0,
      quarterRevenue,
      quarterGoal,
      yearToDateRevenue: ytdRevenue,
      yearToDateGoal: ytdGoal,
      monthlyData,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to fetch revenue data, returning mock data');
    return getMockRevenue();
  }
}

function getMockRevenue(): RevenueData {
  // Mock quarterly data aggregated from Q1 months (Jan-Mar)
  return {
    currentMonthRevenue: 125000,
    currentMonthGoal: 150000,
    quarterRevenue: 370000,
    quarterGoal: 375000,
    yearToDateRevenue: 1250000,
    yearToDateGoal: 1500000,
    monthlyData: [
      { month: 'Jan', revenue: 120000, goal: 125000 },
      { month: 'Feb', revenue: 135000, goal: 125000 },
      { month: 'Mar', revenue: 115000, goal: 125000 },
      { month: 'Apr', revenue: 140000, goal: 125000 },
      { month: 'May', revenue: 130000, goal: 125000 },
      { month: 'Jun', revenue: 125000, goal: 150000 },
      { month: 'Jul', revenue: 0, goal: 150000 },
      { month: 'Aug', revenue: 0, goal: 150000 },
      { month: 'Sep', revenue: 0, goal: 150000 },
      { month: 'Oct', revenue: 0, goal: 150000 },
      { month: 'Nov', revenue: 0, goal: 150000 },
      { month: 'Dec', revenue: 0, goal: 175000 },
    ],
  };
}
