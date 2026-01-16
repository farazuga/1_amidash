import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from 'date-fns';

// ==========================================
// INTERFACES
// ==========================================

export interface HealthMetrics {
  salesHealth: number; // % of PO goal achieved
  opsHealth: number; // Invoice/PO ratio
  diagnosis: 'healthy' | 'sales' | 'operations' | 'both';
  message: string;
  bottlenecks: {
    procurement: number;
    engineering: number;
  };
}

export interface StuckProject {
  id: string;
  clientName: string;
  salesAmount: number;
  statusName: string;
  daysInStatus: number;
}

export interface OverdueProject {
  id: string;
  clientName: string;
  salesAmount: number;
  daysOverdue: number;
  goalDate: string;
}

export interface AlertsData {
  stuckProjects: StuckProject[];
  overdueProjects: OverdueProject[];
  totalStuck: number;
  totalOverdue: number;
  stuckRevenue: number;
  overdueRevenue: number;
  hasAlerts: boolean;
}

export interface PerformanceMetrics {
  onTimePercent: number;
  dti: number; // Days to Invoice
  backlogDepth: number; // Months of work
  customerConcentration: number; // % from top 3 clients
  concentrationRisk: 'low' | 'medium' | 'high';
  topClients: { name: string; revenue: number; percent: number }[];
}

export interface VelocityMonth {
  month: string;
  posReceived: number;
  invoiced: number;
}

export interface VelocityData {
  monthly: VelocityMonth[];
  totalPOs: number;
  totalInvoiced: number;
  netChange: number;
  trend: 'growing' | 'shrinking' | 'stable';
}

export interface CycleTimeStatus {
  name: string;
  avgDays: number;
  isBottleneck: boolean;
  color: string;
}

export interface CycleTimeData {
  statuses: CycleTimeStatus[];
  totalAvgCycleTime: number;
}

export interface StatusPipelineItem {
  name: string;
  count: number;
  revenue: number;
  color: string;
  isBottleneck: boolean;
}

export interface StatusPipelineData {
  statuses: StatusPipelineItem[];
  totalProjects: number;
  totalRevenue: number;
}

export interface DashboardMetrics {
  health: HealthMetrics;
  alerts: AlertsData;
  performance: PerformanceMetrics;
  velocity: VelocityData;
  cycleTime: CycleTimeData;
  pipeline: StatusPipelineData;
}

// ==========================================
// CONSTANTS
// ==========================================

const STUCK_THRESHOLD_DAYS = 14;
const SALES_HEALTH_THRESHOLD = 80;
const OPS_HEALTH_THRESHOLD = 60;
const CONCENTRATION_HIGH_THRESHOLD = 70;
const CONCENTRATION_MEDIUM_THRESHOLD = 50;

// ==========================================
// MAIN FETCH FUNCTION
// ==========================================

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock dashboard metrics');
    return getMockDashboardMetrics();
  }

  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Fetch all needed data in parallel
    const [
      projectsResult,
      statusesResult,
      statusHistoryResult,
      goalsResult,
    ] = await Promise.all([
      supabase
        .from('projects')
        .select(`
          id,
          client_name,
          sales_amount,
          created_date,
          goal_completion_date,
          current_status_id,
          statuses:current_status_id(id, name, display_order)
        `),
      supabase.from('statuses').select('id, name, display_order'),
      supabase
        .from('status_history')
        .select(`
          id,
          project_id,
          status_id,
          changed_at,
          statuses:status_id(name),
          projects:project_id(id, client_name, sales_amount, goal_completion_date, created_date)
        `)
        .order('changed_at', { ascending: false }),
      supabase
        .from('revenue_goals')
        .select('*')
        .eq('year', currentYear),
    ]);

    const projects = projectsResult.data || [];
    const statuses = statusesResult.data || [];
    const statusHistory = statusHistoryResult.data || [];
    const goals = goalsResult.data || [];

    // Find invoiced status
    const invoicedStatus = statuses.find(
      (s) => s.name.toLowerCase().includes('invoiced')
    );
    const invoicedStatusId = invoicedStatus?.id;

    // Filter active projects (not invoiced)
    const activeProjects = projects.filter(
      (p) => p.current_status_id !== invoicedStatusId
    );

    // Calculate all metrics
    const health = calculateHealthMetrics(
      projects,
      statusHistory,
      goals,
      statuses,
      currentMonth,
      invoicedStatusId
    );
    const alerts = calculateAlertsData(
      activeProjects,
      statusHistory,
      invoicedStatusId
    );
    const performance = calculatePerformanceMetrics(
      projects,
      activeProjects,
      statusHistory,
      invoicedStatusId
    );
    const velocity = calculateVelocityData(projects, statusHistory, invoicedStatusId);
    const cycleTime = calculateCycleTimeData(
      projects,
      statusHistory,
      statuses,
      invoicedStatusId
    );
    const pipeline = calculateStatusPipeline(activeProjects, statuses);

    return {
      health,
      alerts,
      performance,
      velocity,
      cycleTime,
      pipeline,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to fetch dashboard metrics');
    return getMockDashboardMetrics();
  }
}

// ==========================================
// CALCULATION FUNCTIONS
// ==========================================

function calculateHealthMetrics(
  projects: Record<string, unknown>[],
  statusHistory: Record<string, unknown>[],
  goals: Record<string, unknown>[],
  statuses: { id: string; name: string }[],
  currentMonth: number,
  invoicedStatusId: string | undefined
): HealthMetrics {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Get current month goal
  const monthGoal = goals.find((g) => g.month === currentMonth);
  const goalAmount = (monthGoal?.revenue_goal as number) || 0;

  // Calculate POs received this month
  const posThisMonth = projects.filter((p) => {
    const createdAt = p.created_at ? new Date(p.created_at as string) : null;
    return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
  });
  const posRevenue = posThisMonth.reduce(
    (sum, p) => sum + ((p.sales_amount as number) || 0),
    0
  );

  // Calculate invoiced this month
  const invoicedThisMonth = statusHistory.filter((h) => {
    const status = h.statuses as { name: string } | null;
    if (status?.name?.toLowerCase().includes('invoiced') === false) return false;
    const changedAt = h.changed_at ? new Date(h.changed_at as string) : null;
    return changedAt && changedAt >= monthStart && changedAt <= monthEnd;
  });
  const invoicedRevenue = invoicedThisMonth.reduce((sum, h) => {
    const project = h.projects as { sales_amount: number } | null;
    return sum + (project?.sales_amount || 0);
  }, 0);

  // Calculate health percentages
  const salesHealth = goalAmount > 0 ? (posRevenue / goalAmount) * 100 : 100;
  const opsHealth = posRevenue > 0 ? (invoicedRevenue / posRevenue) * 100 : 100;

  // Find bottleneck statuses
  const procurementStatus = statuses.find(
    (s) =>
      s.name.toLowerCase().includes('procurement') ||
      s.name.toLowerCase().includes('material')
  );
  const engineeringStatus = statuses.find(
    (s) =>
      s.name.toLowerCase().includes('engineering') ||
      s.name.toLowerCase().includes('design')
  );

  const procurementCount = projects.filter(
    (p) => p.current_status_id === procurementStatus?.id
  ).length;
  const engineeringCount = projects.filter(
    (p) => p.current_status_id === engineeringStatus?.id
  ).length;

  // Determine diagnosis
  let diagnosis: 'healthy' | 'sales' | 'operations' | 'both';
  let message: string;

  if (salesHealth < SALES_HEALTH_THRESHOLD && opsHealth >= SALES_HEALTH_THRESHOLD) {
    diagnosis = 'sales';
    message = 'Low PO intake is the bottleneck';
  } else if (salesHealth >= SALES_HEALTH_THRESHOLD && opsHealth < OPS_HEALTH_THRESHOLD) {
    diagnosis = 'operations';
    message = 'Operations behind on delivery';
  } else if (salesHealth < SALES_HEALTH_THRESHOLD && opsHealth < OPS_HEALTH_THRESHOLD) {
    diagnosis = 'both';
    message = 'Both sales and ops need attention';
  } else {
    diagnosis = 'healthy';
    message = 'All systems healthy';
  }

  return {
    salesHealth: Math.min(salesHealth, 100),
    opsHealth: Math.min(opsHealth, 100),
    diagnosis,
    message,
    bottlenecks: {
      procurement: procurementCount,
      engineering: engineeringCount,
    },
  };
}

function calculateAlertsData(
  activeProjects: Record<string, unknown>[],
  statusHistory: Record<string, unknown>[],
  invoicedStatusId: string | undefined
): AlertsData {
  const now = new Date();

  // Find stuck projects (in same status > threshold days)
  const stuckProjects: StuckProject[] = [];
  const projectLastStatusChange = new Map<string, { date: Date; statusName: string }>();

  // Build map of last status change for each project
  statusHistory.forEach((h) => {
    const projectId = h.project_id as string;
    const changedAt = new Date(h.changed_at as string);
    const status = h.statuses as { name: string } | null;

    if (!projectLastStatusChange.has(projectId)) {
      projectLastStatusChange.set(projectId, {
        date: changedAt,
        statusName: status?.name || 'Unknown',
      });
    }
  });

  activeProjects.forEach((p) => {
    const lastChange = projectLastStatusChange.get(p.id as string);
    if (!lastChange) return;

    const daysInStatus = differenceInDays(now, lastChange.date);
    if (daysInStatus >= STUCK_THRESHOLD_DAYS) {
      stuckProjects.push({
        id: p.id as string,
        clientName: p.client_name as string,
        salesAmount: (p.sales_amount as number) || 0,
        statusName: lastChange.statusName,
        daysInStatus,
      });
    }
  });

  // Sort by days in status descending
  stuckProjects.sort((a, b) => b.daysInStatus - a.daysInStatus);

  // Find overdue projects
  const overdueProjects: OverdueProject[] = activeProjects
    .filter((p) => {
      const goalDate = p.goal_completion_date
        ? new Date(p.goal_completion_date as string)
        : null;
      return goalDate && goalDate < now;
    })
    .map((p) => {
      const goalDate = new Date(p.goal_completion_date as string);
      return {
        id: p.id as string,
        clientName: p.client_name as string,
        salesAmount: (p.sales_amount as number) || 0,
        daysOverdue: differenceInDays(now, goalDate),
        goalDate: format(goalDate, 'MMM d'),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const stuckRevenue = stuckProjects.reduce((sum, p) => sum + p.salesAmount, 0);
  const overdueRevenue = overdueProjects.reduce((sum, p) => sum + p.salesAmount, 0);

  return {
    stuckProjects: stuckProjects.slice(0, 5),
    overdueProjects: overdueProjects.slice(0, 5),
    totalStuck: stuckProjects.length,
    totalOverdue: overdueProjects.length,
    stuckRevenue,
    overdueRevenue,
    hasAlerts: stuckProjects.length > 0 || overdueProjects.length > 0,
  };
}

function calculatePerformanceMetrics(
  projects: Record<string, unknown>[],
  activeProjects: Record<string, unknown>[],
  statusHistory: Record<string, unknown>[],
  invoicedStatusId: string | undefined
): PerformanceMetrics {
  // Calculate on-time completion %
  const invoicedHistory = statusHistory.filter((h) => {
    const status = h.statuses as { name: string } | null;
    return status?.name?.toLowerCase().includes('invoiced');
  });

  let onTime = 0;
  let late = 0;
  let totalDaysToInvoice = 0;
  let invoiceCount = 0;

  invoicedHistory.forEach((h) => {
    const project = h.projects as {
      goal_completion_date: string;
      created_date: string;
      sales_amount: number;
    } | null;
    if (!project) return;

    const invoicedAt = new Date(h.changed_at as string);
    // Use created_date (user-editable PO date), not created_at (system timestamp)
    const createdDate = project.created_date ? new Date(project.created_date) : null;
    const goalDate = project.goal_completion_date
      ? new Date(project.goal_completion_date)
      : null;

    if (goalDate) {
      if (invoicedAt <= goalDate) {
        onTime++;
      } else {
        late++;
      }
    }

    if (createdDate) {
      totalDaysToInvoice += differenceInDays(invoicedAt, createdDate);
      invoiceCount++;
    }
  });

  const onTimePercent =
    onTime + late > 0 ? (onTime / (onTime + late)) * 100 : 0;
  const dti = invoiceCount > 0 ? Math.round(totalDaysToInvoice / invoiceCount) : 0;

  // Calculate backlog depth
  const sixMonthsAgo = subMonths(new Date(), 6);
  const recentInvoiced = invoicedHistory.filter((h) => {
    const changedAt = new Date(h.changed_at as string);
    return changedAt >= sixMonthsAgo;
  });

  const invoicedRevenue6Mo = recentInvoiced.reduce((sum, h) => {
    const project = h.projects as { sales_amount: number } | null;
    return sum + (project?.sales_amount || 0);
  }, 0);
  const avgMonthlyInvoiced = invoicedRevenue6Mo / 6;

  const pipelineRevenue = activeProjects.reduce(
    (sum, p) => sum + ((p.sales_amount as number) || 0),
    0
  );

  const backlogDepth =
    avgMonthlyInvoiced > 0
      ? Math.round((pipelineRevenue / avgMonthlyInvoiced) * 10) / 10
      : 0;

  // Calculate customer concentration
  const clientRevenue = new Map<string, number>();
  activeProjects.forEach((p) => {
    const client = (p.client_name as string) || 'Unknown';
    clientRevenue.set(
      client,
      (clientRevenue.get(client) || 0) + ((p.sales_amount as number) || 0)
    );
  });

  const sortedClients = Array.from(clientRevenue.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const top3 = sortedClients.slice(0, 3);
  const top3Revenue = top3.reduce((sum, c) => sum + c.revenue, 0);
  const totalRevenue = sortedClients.reduce((sum, c) => sum + c.revenue, 0);
  const customerConcentration =
    totalRevenue > 0 ? (top3Revenue / totalRevenue) * 100 : 0;

  let concentrationRisk: 'low' | 'medium' | 'high';
  if (customerConcentration < CONCENTRATION_MEDIUM_THRESHOLD) {
    concentrationRisk = 'low';
  } else if (customerConcentration < CONCENTRATION_HIGH_THRESHOLD) {
    concentrationRisk = 'medium';
  } else {
    concentrationRisk = 'high';
  }

  const topClients = top3.map((c) => ({
    name: c.name,
    revenue: c.revenue,
    percent: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
  }));

  return {
    onTimePercent,
    dti,
    backlogDepth,
    customerConcentration,
    concentrationRisk,
    topClients,
  };
}

function calculateVelocityData(
  projects: Record<string, unknown>[],
  statusHistory: Record<string, unknown>[],
  invoicedStatusId: string | undefined
): VelocityData {
  const now = new Date();
  const monthly: VelocityMonth[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(now, i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const monthStr = format(date, 'MMM');

    // POs received (uses created_date - user-editable PO date, not created_at system timestamp)
    const posInMonth = projects.filter((p) => {
      const createdDate = p.created_date ? new Date(p.created_date as string) : null;
      return createdDate && createdDate >= monthStart && createdDate <= monthEnd;
    }).length;

    // Invoiced
    const invoicedInMonth = statusHistory.filter((h) => {
      const status = h.statuses as { name: string } | null;
      if (!status?.name?.toLowerCase().includes('invoiced')) return false;
      const changedAt = new Date(h.changed_at as string);
      return changedAt >= monthStart && changedAt <= monthEnd;
    }).length;

    monthly.push({
      month: monthStr,
      posReceived: posInMonth,
      invoiced: invoicedInMonth,
    });
  }

  const totalPOs = monthly.reduce((sum, m) => sum + m.posReceived, 0);
  const totalInvoiced = monthly.reduce((sum, m) => sum + m.invoiced, 0);
  const netChange = totalPOs - totalInvoiced;

  let trend: 'growing' | 'shrinking' | 'stable';
  if (netChange > 2) {
    trend = 'growing';
  } else if (netChange < -2) {
    trend = 'shrinking';
  } else {
    trend = 'stable';
  }

  return {
    monthly,
    totalPOs,
    totalInvoiced,
    netChange,
    trend,
  };
}

function calculateCycleTimeData(
  projects: Record<string, unknown>[],
  statusHistory: Record<string, unknown>[],
  statuses: { id: string; name: string; display_order: number }[],
  invoicedStatusId: string | undefined
): CycleTimeData {
  const statusTimes = new Map<
    string,
    { totalDays: number; count: number; displayOrder: number }
  >();

  // Group history by project
  const projectHistories = new Map<string, Record<string, unknown>[]>();
  statusHistory.forEach((h) => {
    const projectId = h.project_id as string;
    if (!projectHistories.has(projectId)) {
      projectHistories.set(projectId, []);
    }
    projectHistories.get(projectId)!.push(h);
  });

  // Calculate time in each status
  projectHistories.forEach((history, projectId) => {
    // Sort by date ascending
    history.sort(
      (a, b) =>
        new Date(a.changed_at as string).getTime() -
        new Date(b.changed_at as string).getTime()
    );

    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      const next = history[i + 1];
      const status = current.statuses as { name: string } | null;
      const statusName = status?.name;

      if (!statusName || statusName.toLowerCase().includes('invoiced')) continue;

      const startDate = new Date(current.changed_at as string);
      const endDate = next
        ? new Date(next.changed_at as string)
        : new Date();
      const daysInStatus = differenceInDays(endDate, startDate);

      const statusInfo = statuses.find((s) => s.name === statusName);
      const existing = statusTimes.get(statusName);
      if (existing) {
        existing.totalDays += daysInStatus;
        existing.count++;
      } else {
        statusTimes.set(statusName, {
          totalDays: daysInStatus,
          count: 1,
          displayOrder: statusInfo?.display_order || 999,
        });
      }
    }
  });

  // Calculate averages
  const cycleTimeStatuses: CycleTimeStatus[] = Array.from(
    statusTimes.entries()
  )
    .map(([name, data]) => {
      const isBottleneck =
        name.toLowerCase().includes('procurement') ||
        name.toLowerCase().includes('engineering') ||
        name.toLowerCase().includes('material');
      return {
        name,
        avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
        isBottleneck,
        color: isBottleneck ? '#f59e0b' : '#053B2C',
      };
    })
    .sort((a, b) => {
      const aOrder = statusTimes.get(a.name)?.displayOrder || 999;
      const bOrder = statusTimes.get(b.name)?.displayOrder || 999;
      return aOrder - bOrder;
    });

  const totalAvgCycleTime = cycleTimeStatuses.reduce(
    (sum, s) => sum + s.avgDays,
    0
  );

  return {
    statuses: cycleTimeStatuses,
    totalAvgCycleTime,
  };
}

function calculateStatusPipeline(
  activeProjects: Record<string, unknown>[],
  statuses: { id: string; name: string; display_order: number }[]
): StatusPipelineData {
  const statusCounts = new Map<
    string,
    { count: number; revenue: number; displayOrder: number }
  >();

  activeProjects.forEach((p) => {
    const status = p.statuses as { id: string; name: string } | null;
    const statusName = status?.name || 'Unknown';
    const statusInfo = statuses.find((s) => s.id === p.current_status_id);

    const existing = statusCounts.get(statusName);
    if (existing) {
      existing.count++;
      existing.revenue += (p.sales_amount as number) || 0;
    } else {
      statusCounts.set(statusName, {
        count: 1,
        revenue: (p.sales_amount as number) || 0,
        displayOrder: statusInfo?.display_order || 999,
      });
    }
  });

  const pipelineStatuses: StatusPipelineItem[] = Array.from(
    statusCounts.entries()
  )
    .map(([name, data]) => {
      const isBottleneck =
        name.toLowerCase().includes('procurement') ||
        name.toLowerCase().includes('engineering') ||
        name.toLowerCase().includes('material');
      return {
        name,
        count: data.count,
        revenue: data.revenue,
        color: isBottleneck ? '#f59e0b' : '#053B2C',
        isBottleneck,
      };
    })
    .sort((a, b) => {
      const aOrder = statusCounts.get(a.name)?.displayOrder || 999;
      const bOrder = statusCounts.get(b.name)?.displayOrder || 999;
      return aOrder - bOrder;
    });

  return {
    statuses: pipelineStatuses,
    totalProjects: activeProjects.length,
    totalRevenue: activeProjects.reduce(
      (sum, p) => sum + ((p.sales_amount as number) || 0),
      0
    ),
  };
}

// ==========================================
// MOCK DATA
// ==========================================

function getMockDashboardMetrics(): DashboardMetrics {
  return {
    health: {
      salesHealth: 85,
      opsHealth: 72,
      diagnosis: 'healthy',
      message: 'All systems healthy',
      bottlenecks: {
        procurement: 3,
        engineering: 2,
      },
    },
    alerts: {
      stuckProjects: [
        {
          id: '1',
          clientName: 'Acme Corp',
          salesAmount: 45000,
          statusName: 'Procurement',
          daysInStatus: 18,
        },
        {
          id: '2',
          clientName: 'TechStart',
          salesAmount: 32000,
          statusName: 'Engineering',
          daysInStatus: 16,
        },
      ],
      overdueProjects: [
        {
          id: '3',
          clientName: 'GlobalCo',
          salesAmount: 78000,
          daysOverdue: 5,
          goalDate: 'Jan 1',
        },
      ],
      totalStuck: 2,
      totalOverdue: 1,
      stuckRevenue: 77000,
      overdueRevenue: 78000,
      hasAlerts: true,
    },
    performance: {
      onTimePercent: 78,
      dti: 42,
      backlogDepth: 4.2,
      customerConcentration: 58,
      concentrationRisk: 'medium',
      topClients: [
        { name: 'Acme Corp', revenue: 125000, percent: 28 },
        { name: 'TechStart', revenue: 95000, percent: 21 },
        { name: 'GlobalCo', revenue: 40000, percent: 9 },
      ],
    },
    velocity: {
      monthly: [
        { month: 'Aug', posReceived: 8, invoiced: 6 },
        { month: 'Sep', posReceived: 12, invoiced: 9 },
        { month: 'Oct', posReceived: 10, invoiced: 11 },
        { month: 'Nov', posReceived: 9, invoiced: 8 },
        { month: 'Dec', posReceived: 11, invoiced: 10 },
        { month: 'Jan', posReceived: 7, invoiced: 5 },
      ],
      totalPOs: 57,
      totalInvoiced: 49,
      netChange: 8,
      trend: 'growing',
    },
    cycleTime: {
      statuses: [
        { name: 'New', avgDays: 2, isBottleneck: false, color: '#053B2C' },
        { name: 'Planning', avgDays: 5, isBottleneck: false, color: '#053B2C' },
        {
          name: 'Procurement',
          avgDays: 12,
          isBottleneck: true,
          color: '#f59e0b',
        },
        {
          name: 'Engineering',
          avgDays: 8,
          isBottleneck: true,
          color: '#f59e0b',
        },
        { name: 'Testing', avgDays: 3, isBottleneck: false, color: '#053B2C' },
        { name: 'Review', avgDays: 4, isBottleneck: false, color: '#053B2C' },
      ],
      totalAvgCycleTime: 34,
    },
    pipeline: {
      statuses: [
        {
          name: 'New',
          count: 4,
          revenue: 120000,
          color: '#053B2C',
          isBottleneck: false,
        },
        {
          name: 'Planning',
          count: 3,
          revenue: 85000,
          color: '#053B2C',
          isBottleneck: false,
        },
        {
          name: 'Procurement',
          count: 5,
          revenue: 195000,
          color: '#f59e0b',
          isBottleneck: true,
        },
        {
          name: 'Engineering',
          count: 4,
          revenue: 156000,
          color: '#f59e0b',
          isBottleneck: true,
        },
        {
          name: 'Testing',
          count: 2,
          revenue: 68000,
          color: '#053B2C',
          isBottleneck: false,
        },
        {
          name: 'Review',
          count: 2,
          revenue: 54000,
          color: '#053B2C',
          isBottleneck: false,
        },
      ],
      totalProjects: 20,
      totalRevenue: 678000,
    },
  };
}
