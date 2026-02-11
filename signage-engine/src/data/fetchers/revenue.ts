import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';

export interface RevenueData {
  currentMonthRevenue: number;
  currentMonthGoal: number;
  yearToDateRevenue: number;
  yearToDateGoal: number;
  monthlyData: { month: string; revenue: number; goal: number }[];
}

export async function fetchRevenueData(): Promise<RevenueData> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock revenue');
    return getMockRevenue();
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Fetch revenue goals (only needed fields)
    const { data: goals } = await supabase
      .from('revenue_goals')
      .select('month, amount')
      .eq('year', currentYear);

    // Fetch invoiced projects this year
    const { data: invoiced } = await supabase
      .from('status_history')
      .select(`
        changed_at,
        projects(total_value)
      `)
      .eq('new_status_id', (await getInvoicedStatusId()))
      .gte('changed_at', `${currentYear}-01-01`);

    const monthlyRevenue = new Map<number, number>();
    (invoiced || []).forEach((item: Record<string, unknown>) => {
      const date = new Date(item.changed_at as string);
      const month = date.getMonth() + 1;
      const value = (item.projects as { total_value: number } | null)?.total_value || 0;
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + value);
    });

    const monthlyData = [];
    let ytdRevenue = 0;
    let ytdGoal = 0;

    for (let m = 1; m <= 12; m++) {
      const goal = goals?.find((g: Record<string, unknown>) => g.month === m);
      const revenue = monthlyRevenue.get(m) || 0;
      if (m <= currentMonth) {
        ytdRevenue += revenue;
        ytdGoal += goal?.amount || 0;
      }
      monthlyData.push({
        month: new Date(currentYear, m - 1).toLocaleString('default', { month: 'short' }),
        revenue,
        goal: goal?.amount || 0,
      });
    }

    return {
      currentMonthRevenue: monthlyRevenue.get(currentMonth) || 0,
      currentMonthGoal: goals?.find((g: Record<string, unknown>) => g.month === currentMonth)?.amount || 0,
      yearToDateRevenue: ytdRevenue,
      yearToDateGoal: ytdGoal,
      monthlyData,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to fetch revenue data, returning mock data');
    return getMockRevenue();
  }
}

async function getInvoicedStatusId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('statuses')
    .select('id')
    .ilike('name', '%invoiced%')
    .single();
  return data?.id || null;
}

function getMockRevenue(): RevenueData {
  return {
    currentMonthRevenue: 125000,
    currentMonthGoal: 150000,
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
