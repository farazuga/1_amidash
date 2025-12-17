import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import type { RevenueData, MonthlyRevenueData, RevenueGoal, StatusHistory } from '../../types/database.js';

/**
 * Fetch revenue data for the dashboard
 */
export async function fetchRevenueData(): Promise<RevenueData> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  try {
    // Fetch all data in parallel
    const [goalsRes, projectsRes, statusHistoryRes] = await Promise.all([
      // Get revenue goals
      supabase
        .from('revenue_goals')
        .select('*')
        .eq('year', currentYear),

      // Get all projects with sales amounts
      supabase
        .from('projects')
        .select('id, sales_amount, created_at, current_status_id'),

      // Get status history for "Invoiced" status to calculate invoiced revenue
      supabase
        .from('status_history')
        .select(`
          id,
          project_id,
          status_id,
          changed_at,
          status:statuses(name),
          project:projects(id, client_name, sales_amount)
        `)
        .order('changed_at', { ascending: false }),
    ]);

    if (goalsRes.error) {
      logger.error({ error: goalsRes.error }, 'Failed to fetch revenue goals');
    }
    if (projectsRes.error) {
      logger.error({ error: projectsRes.error }, 'Failed to fetch projects');
    }
    if (statusHistoryRes.error) {
      logger.error({ error: statusHistoryRes.error }, 'Failed to fetch status history');
    }

    const goals = (goalsRes.data || []) as unknown as RevenueGoal[];
    const projects = projectsRes.data || [];
    const statusHistory = (statusHistoryRes.data || []) as unknown as StatusHistory[];

    // Find current month's goal
    const currentMonthGoal = goals.find((g) => g.month === currentMonth);
    const monthlyGoal = currentMonthGoal?.revenue_goal || 0;
    const invoicedGoal = currentMonthGoal?.invoiced_revenue_goal || 0;

    // Calculate current month revenue (projects created this month)
    const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString();
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

    const currentMonthProjects = projects.filter((p) => {
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      return createdAt && createdAt >= new Date(monthStart) && createdAt <= new Date(monthEnd);
    });

    const currentMonthRevenue = currentMonthProjects.reduce(
      (sum, p) => sum + (p.sales_amount || 0),
      0
    );

    // Calculate invoiced revenue (projects that have reached "Invoiced" status this month)
    const invoicedHistory = statusHistory.filter((h) => {
      const statusName = (h.status as { name: string } | null)?.name || '';
      const changedAt = h.changed_at ? new Date(h.changed_at) : null;
      return (
        statusName.toLowerCase().includes('invoiced') &&
        changedAt &&
        changedAt >= new Date(monthStart) &&
        changedAt <= new Date(monthEnd)
      );
    });

    // Get unique project IDs that were invoiced
    const invoicedProjectIds = new Set(invoicedHistory.map((h) => h.project_id));
    const invoicedRevenue = invoicedHistory.reduce((sum, h) => {
      const project = h.project as { sales_amount: number | null } | null;
      // Only count each project once
      if (invoicedProjectIds.has(h.project_id)) {
        invoicedProjectIds.delete(h.project_id);
        return sum + (project?.sales_amount || 0);
      }
      return sum;
    }, 0);

    // Calculate pipeline (total uncompleted projects)
    const pipelineTotal = projects.reduce(
      (sum, p) => sum + (p.sales_amount || 0),
      0
    );

    // Calculate month progress percentage
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

    // Build monthly data for the chart (last 6 months)
    const monthlyData: MonthlyRevenueData[] = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth() + 1;
      const monthName = targetDate.toLocaleString('default', { month: 'short' });

      const mStart = new Date(targetYear, targetMonth - 1, 1);
      const mEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      const monthProjects = projects.filter((p) => {
        const createdAt = p.created_at ? new Date(p.created_at) : null;
        return createdAt && createdAt >= mStart && createdAt <= mEnd;
      });

      const monthRevenue = monthProjects.reduce(
        (sum, p) => sum + (p.sales_amount || 0),
        0
      );

      const monthGoal = goals.find(
        (g) => g.year === targetYear && g.month === targetMonth
      );

      monthlyData.push({
        month: monthName,
        revenue: monthRevenue,
        goal: monthGoal?.revenue_goal || 0,
      });
    }

    logger.info(
      {
        currentMonthRevenue,
        monthlyGoal,
        invoicedRevenue,
        invoicedGoal,
        pipelineTotal,
      },
      'Fetched revenue data'
    );

    return {
      currentMonthRevenue,
      monthlyGoal,
      invoicedRevenue,
      invoicedGoal,
      pipelineTotal,
      monthProgress,
      monthlyData,
    };
  } catch (error) {
    logger.error({ error }, 'Exception fetching revenue data');
    throw error;
  }
}

/**
 * Fetch revenue goals for a specific year
 */
export async function fetchRevenueGoals(year: number): Promise<RevenueGoal[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('revenue_goals')
      .select('*')
      .eq('year', year)
      .order('month');

    if (error) {
      logger.error({ error, year }, 'Failed to fetch revenue goals');
      throw error;
    }

    return (data || []) as unknown as RevenueGoal[];
  } catch (error) {
    logger.error({ error, year }, 'Exception fetching revenue goals');
    throw error;
  }
}
