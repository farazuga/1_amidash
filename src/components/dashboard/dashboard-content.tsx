'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  FolderKanban,
  Clock,
  CheckCircle,
  ArrowRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShoppingCart,
  Wrench,
  Timer,
  Layers,
  Target,
  Users,
  BarChart3,
  Activity,
} from 'lucide-react';
import { LazyRevenueChart, LazyStatusChart } from '@/components/dashboard/lazy-charts';
import { OverdueProjects } from '@/components/dashboard/overdue-projects';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import type { DashboardData } from '@/app/actions/dashboard';

type PeriodType = 'month' | 'quarter' | 'year';

interface DashboardContentProps {
  initialData: DashboardData;
}

export function DashboardContent({ initialData }: DashboardContentProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // Use data from server
  const { projects, statuses, statusHistory, goals, thresholds } = initialData;

  // Initialize selected period to current
  useEffect(() => {
    const now = new Date();
    if (periodType === 'month') {
      setSelectedPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    } else if (periodType === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      setSelectedPeriod(`${now.getFullYear()}-Q${quarter}`);
    } else {
      setSelectedPeriod(String(now.getFullYear()));
    }
  }, [periodType]);

  // Get date range for selected period
  const getDateRange = () => {
    if (!selectedPeriod) return { start: new Date(), end: new Date() };

    if (periodType === 'month') {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return { start: startOfMonth(date), end: endOfMonth(date) };
    } else if (periodType === 'quarter') {
      const [year, q] = selectedPeriod.split('-Q');
      const quarterMonth = (parseInt(q) - 1) * 3;
      const date = new Date(parseInt(year), quarterMonth, 1);
      return { start: startOfQuarter(date), end: endOfQuarter(date) };
    } else {
      const year = parseInt(selectedPeriod);
      return { start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) };
    }
  };

  // Generate period options
  const getPeriodOptions = () => {
    const now = new Date();
    const options: { value: string; label: string }[] = [];

    if (periodType === 'month') {
      // Last 12 months + next 6 months
      for (let i = -12; i <= 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        options.push({
          value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          label: format(date, 'MMMM yyyy'),
        });
      }
    } else if (periodType === 'quarter') {
      // Last 4 quarters + next 2 quarters
      for (let i = -4; i <= 2; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i * 3, 1);
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        options.push({
          value: `${date.getFullYear()}-Q${quarter}`,
          label: `Q${quarter} ${date.getFullYear()}`,
        });
      }
      // Remove duplicates
      const seen = new Set();
      return options.filter(o => {
        if (seen.has(o.value)) return false;
        seen.add(o.value);
        return true;
      });
    } else {
      // Last 3 years + next 2 years
      for (let i = -3; i <= 2; i++) {
        const year = now.getFullYear() + i;
        options.push({
          value: String(year),
          label: String(year),
        });
      }
    }

    return options;
  };

  // Calculate stats for selected period - memoize expensive calculations
  const dateRange = useMemo(() => getDateRange(), [selectedPeriod, periodType]);
  const invoicedStatus = useMemo(() => statuses.find(s => s.name === 'Invoiced'), [statuses]);

  // Get invoiced projects in period (from status history)
  const invoicedInPeriod = useMemo(() => statusHistory.filter(h => {
    if (h.status?.name !== 'Invoiced') return false;
    const changedAt = new Date(h.changed_at);
    return changedAt >= dateRange.start && changedAt <= dateRange.end;
  }), [statusHistory, dateRange]);

  // Revenue invoiced in period
  const invoicedRevenue = useMemo(() => invoicedInPeriod.reduce((sum, h) => {
    return sum + (h.project?.sales_amount || 0);
  }, 0), [invoicedInPeriod]);

  // Projects created (POs received) in period
  const projectsCreatedInPeriod = useMemo(() => projects.filter(p => {
    if (!p.created_at) return false;
    const createdAt = new Date(p.created_at);
    return createdAt >= dateRange.start && createdAt <= dateRange.end;
  }), [projects, dateRange]);

  // Revenue from POs received in period
  const posReceivedRevenue = useMemo(() => projectsCreatedInPeriod.reduce((sum, p) => {
    return sum + (p.sales_amount || 0);
  }, 0), [projectsCreatedInPeriod]);

  // Get goal for period - memoized (now includes invoiced_revenue_goal)
  const periodGoal = useMemo(() => {
    if (periodType === 'month') {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const goal = goals.find(g => g.year === year && g.month === month);
      return {
        revenue: goal?.revenue_goal || 0,
        invoicedRevenue: goal?.invoiced_revenue_goal || 0
      };
    } else if (periodType === 'quarter') {
      const [year, q] = selectedPeriod.split('-Q');
      const startMonth = (parseInt(q) - 1) * 3 + 1;
      let revenue = 0;
      let invoicedRevenueGoal = 0;
      for (let m = startMonth; m < startMonth + 3; m++) {
        const goal = goals.find(g => g.year === parseInt(year) && g.month === m);
        revenue += goal?.revenue_goal || 0;
        invoicedRevenueGoal += goal?.invoiced_revenue_goal || 0;
      }
      return { revenue, invoicedRevenue: invoicedRevenueGoal };
    } else {
      const year = parseInt(selectedPeriod);
      let revenue = 0;
      let invoicedRevenueGoal = 0;
      for (let m = 1; m <= 12; m++) {
        const goal = goals.find(g => g.year === year && g.month === m);
        revenue += goal?.revenue_goal || 0;
        invoicedRevenueGoal += goal?.invoiced_revenue_goal || 0;
      }
      return { revenue, invoicedRevenue: invoicedRevenueGoal };
    }
  }, [periodType, selectedPeriod, goals]);
  const posReceivedProgress = periodGoal.revenue > 0 ? Math.min((posReceivedRevenue / periodGoal.revenue) * 100, 100) : 0;
  const invoicedRevenueProgress = periodGoal.invoicedRevenue > 0 ? Math.min((invoicedRevenue / periodGoal.invoicedRevenue) * 100, 100) : 0;

  // Overall stats - memoized calculations (only non-invoiced projects)
  const projectsInProgress = useMemo(() =>
    projects.filter(p => p.current_status_id !== invoicedStatus?.id),
    [projects, invoicedStatus]
  );

  const pipelineRevenue = useMemo(() =>
    projectsInProgress.reduce((sum, p) => sum + (p.sales_amount || 0), 0),
    [projectsInProgress]
  );

  const overdueProjects = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return projects.filter(p => {
      if (!p.goal_completion_date) return false;
      if (p.current_status_id === invoicedStatus?.id) return false;
      return new Date(p.goal_completion_date) < today;
    });
  }, [projects, invoicedStatus]);

  // Revenue by month (next 6 months) - memoized
  const revenueByMonth = useMemo(() => {
    const result: { month: string; revenue: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      const monthRevenue = projects.filter(p => {
        if (!p.goal_completion_date) return false;
        const goalDate = new Date(p.goal_completion_date);
        return goalDate.getMonth() === date.getMonth() && goalDate.getFullYear() === date.getFullYear();
      }).reduce((sum, p) => sum + (p.sales_amount || 0), 0);

      result.push({ month: monthStr, revenue: monthRevenue });
    }
    return result;
  }, [projects]);

  // Last 3 invoiced projects - memoized
  const lastInvoiced = useMemo(() => statusHistory
    .filter(h => h.status?.name === 'Invoiced' && h.project)
    .slice(0, 3), [statusHistory]);

  // Last 3 new projects - memoized
  const lastCreated = useMemo(() => [...projects]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 3), [projects]);

  // Average days to invoice - memoized
  const avgDaysToInvoice = useMemo(() => {
    const invoiceTimesMs: number[] = [];
    projects.forEach(project => {
      const createdAt = project.created_at ? new Date(project.created_at) : null;
      const invoicedEntry = statusHistory.find(
        h => h.project_id === project.id && h.status?.name === 'Invoiced'
      );

      if (createdAt && invoicedEntry) {
        const invoicedAt = new Date(invoicedEntry.changed_at);
        invoiceTimesMs.push(invoicedAt.getTime() - createdAt.getTime());
      }
    });

    return invoiceTimesMs.length > 0
      ? Math.round(invoiceTimesMs.reduce((a, b) => a + b, 0) / invoiceTimesMs.length / (1000 * 60 * 60 * 24))
      : 0;
  }, [projects, statusHistory]);

  // Helper function to get previous period
  const getPreviousPeriod = (period: string, type: PeriodType): { start: Date; end: Date } => {
    if (type === 'month') {
      const [year, month] = period.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1); // month - 2 because months are 0-indexed
      return { start: startOfMonth(prevDate), end: endOfMonth(prevDate) };
    } else if (type === 'quarter') {
      const [year, q] = period.split('-Q');
      const quarterNum = parseInt(q);
      const prevQuarter = quarterNum === 1 ? 4 : quarterNum - 1;
      const prevYear = quarterNum === 1 ? parseInt(year) - 1 : parseInt(year);
      const prevMonth = (prevQuarter - 1) * 3;
      const prevDate = new Date(prevYear, prevMonth, 1);
      return { start: startOfQuarter(prevDate), end: endOfQuarter(prevDate) };
    } else {
      const year = parseInt(period) - 1;
      return { start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) };
    }
  };

  // Previous period calculations for comparison
  const previousPeriodData = useMemo(() => {
    if (!selectedPeriod) return { posReceived: 0, invoiced: 0, projectsCompleted: 0 };

    const prevRange = getPreviousPeriod(selectedPeriod, periodType);

    // POs received in previous period
    const prevPosProjects = projects.filter(p => {
      if (!p.created_at) return false;
      const createdAt = new Date(p.created_at);
      return createdAt >= prevRange.start && createdAt <= prevRange.end;
    });
    const prevPosReceived = prevPosProjects.reduce((sum, p) => sum + (p.sales_amount || 0), 0);

    // Invoiced in previous period
    const prevInvoiced = statusHistory.filter(h => {
      if (h.status?.name !== 'Invoiced') return false;
      const changedAt = new Date(h.changed_at);
      return changedAt >= prevRange.start && changedAt <= prevRange.end;
    });
    const prevInvoicedRevenue = prevInvoiced.reduce((sum, h) => sum + (h.project?.sales_amount || 0), 0);

    return {
      posReceived: prevPosReceived,
      invoiced: prevInvoicedRevenue,
      projectsCompleted: prevInvoiced.length
    };
  }, [selectedPeriod, periodType, projects, statusHistory]);

  // Projects completed count (invoiced this period)
  const projectsCompletedCount = invoicedInPeriod.length;
  const projectsCompletedPrevCount = previousPeriodData.projectsCompleted;

  // Status distribution for bottleneck analysis
  const statusDistribution = useMemo(() => {
    const distribution = statuses
      .filter(s => s.name !== 'Invoiced') // Exclude invoiced from bottleneck view
      .map(status => {
        const projectsInStatus = projects.filter(p => p.current_status_id === status.id);
        const revenue = projectsInStatus.reduce((sum, p) => sum + (p.sales_amount || 0), 0);
        return {
          name: status.name,
          count: projectsInStatus.length,
          revenue,
          color: status.name.toLowerCase().includes('procurement') ? '#f59e0b' :
                 status.name.toLowerCase().includes('engineering') ? '#3b82f6' :
                 '#10B981'
        };
      })
      .filter(s => s.count > 0);
    return distribution;
  }, [statuses, projects]);

  // Sales vs Operations Health Diagnostic
  const diagnosticData = useMemo(() => {
    // Sales health: Are we getting enough POs?
    const salesHealth = periodGoal.revenue > 0
      ? (posReceivedRevenue / periodGoal.revenue) * 100
      : 100;

    // Operations health: Are we completing enough projects?
    // Compare invoiced to POs received ratio
    const completionRatio = posReceivedRevenue > 0
      ? (invoicedRevenue / posReceivedRevenue) * 100
      : 100;

    // Bottleneck analysis - find where projects are stuck
    const procurementStatus = statuses.find(s =>
      s.name.toLowerCase().includes('procurement') ||
      s.name.toLowerCase().includes('material')
    );
    const engineeringStatus = statuses.find(s =>
      s.name.toLowerCase().includes('engineering') ||
      s.name.toLowerCase().includes('design')
    );

    const projectsInProcurement = procurementStatus
      ? projects.filter(p => p.current_status_id === procurementStatus.id).length
      : 0;
    const projectsInEngineering = engineeringStatus
      ? projects.filter(p => p.current_status_id === engineeringStatus.id).length
      : 0;

    const revenueInProcurement = procurementStatus
      ? projects.filter(p => p.current_status_id === procurementStatus.id)
          .reduce((sum, p) => sum + (p.sales_amount || 0), 0)
      : 0;
    const revenueInEngineering = engineeringStatus
      ? projects.filter(p => p.current_status_id === engineeringStatus.id)
          .reduce((sum, p) => sum + (p.sales_amount || 0), 0)
      : 0;

    // Determine the diagnosis using configurable thresholds
    let diagnosis: 'sales' | 'operations' | 'healthy' | 'both';
    let message: string;

    const salesThreshold = thresholds.salesHealthThreshold;
    const opsThreshold = thresholds.operationsHealthThreshold;

    if (salesHealth < salesThreshold && completionRatio >= salesThreshold) {
      diagnosis = 'sales';
      message = 'Low PO intake is the bottleneck. Operations is completing work faster than sales is bringing it in.';
    } else if (salesHealth >= salesThreshold && completionRatio < opsThreshold) {
      diagnosis = 'operations';
      message = 'Sales is healthy but operations is behind. Focus on clearing bottlenecks.';
    } else if (salesHealth < salesThreshold && completionRatio < opsThreshold) {
      diagnosis = 'both';
      message = 'Both sales and operations need attention.';
    } else {
      diagnosis = 'healthy';
      message = 'Both sales intake and operations throughput are healthy.';
    }

    return {
      salesHealth,
      completionRatio,
      projectsInProcurement,
      projectsInEngineering,
      revenueInProcurement,
      revenueInEngineering,
      diagnosis,
      message,
      salesThreshold,
      opsThreshold
    };
  }, [posReceivedRevenue, invoicedRevenue, periodGoal.revenue, statuses, projects, thresholds.salesHealthThreshold, thresholds.operationsHealthThreshold]);

  // ============================================
  // TIER 1 METRICS
  // ============================================

  // 1. WIP Aging - Find projects stuck in their current status
  const wipAgingData = useMemo(() => {
    const today = new Date();
    const stuckThresholdDays = thresholds.wipAgingDays;

    const stuckProjects = projects
      .filter(p => p.current_status_id !== invoicedStatus?.id) // Exclude invoiced
      .map(project => {
        // Find the most recent status change for this project
        const lastStatusChange = statusHistory.find(h => h.project_id === project.id);
        if (!lastStatusChange) return null;

        const changedAt = new Date(lastStatusChange.changed_at);
        const daysInStatus = Math.floor((today.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...project,
          daysInStatus,
          statusName: project.current_status?.name || 'Unknown'
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null && p.daysInStatus >= stuckThresholdDays)
      .sort((a, b) => b.daysInStatus - a.daysInStatus);

    // Group by status for summary
    const stuckByStatus = stuckProjects.reduce((acc, p) => {
      const status = p.statusName;
      if (!acc[status]) acc[status] = { count: 0, revenue: 0, projects: [] as typeof stuckProjects };
      acc[status].count++;
      acc[status].revenue += p.sales_amount || 0;
      acc[status].projects.push(p);
      return acc;
    }, {} as Record<string, { count: number; revenue: number; projects: typeof stuckProjects }>);

    return {
      stuckProjects,
      stuckByStatus,
      totalStuck: stuckProjects.length,
      totalStuckRevenue: stuckProjects.reduce((sum, p) => sum + (p.sales_amount || 0), 0),
      thresholdDays: stuckThresholdDays
    };
  }, [projects, statusHistory, invoicedStatus, thresholds.wipAgingDays]);

  // 2. Backlog Depth - Months of work in queue
  const backlogDepth = useMemo(() => {
    // Calculate average monthly invoiced revenue (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const invoicedLast6Months = statusHistory.filter(h => {
      if (h.status?.name !== 'Invoiced') return false;
      return new Date(h.changed_at) >= sixMonthsAgo;
    });

    const totalInvoicedRevenue = invoicedLast6Months.reduce(
      (sum, h) => sum + (h.project?.sales_amount || 0), 0
    );
    const avgMonthlyInvoiced = totalInvoicedRevenue / 6;

    // Backlog = pipeline revenue / avg monthly invoiced
    const monthsOfWork = avgMonthlyInvoiced > 0 ? pipelineRevenue / avgMonthlyInvoiced : 0;

    return {
      monthsOfWork: Math.round(monthsOfWork * 10) / 10,
      avgMonthlyInvoiced,
      pipelineRevenue
    };
  }, [statusHistory, pipelineRevenue]);

  // 3. On-Time Completion % - Projects invoiced by goal date
  const onTimeCompletion = useMemo(() => {
    const completedProjects = statusHistory.filter(h => h.status?.name === 'Invoiced');

    let onTime = 0;
    let late = 0;

    completedProjects.forEach(h => {
      const project = projects.find(p => p.id === h.project_id);
      if (!project?.goal_completion_date) return;

      const goalDate = new Date(project.goal_completion_date);
      const invoicedDate = new Date(h.changed_at);

      if (invoicedDate <= goalDate) {
        onTime++;
      } else {
        late++;
      }
    });

    const total = onTime + late;
    const percentage = total > 0 ? (onTime / total) * 100 : 0;

    return { onTime, late, total, percentage };
  }, [statusHistory, projects]);

  // ============================================
  // TIER 2 METRICS
  // ============================================

  // 4. Cycle Time Breakdown - Avg days in each status
  const cycleTimeBreakdown = useMemo(() => {
    const statusTimes: Record<string, { totalDays: number; count: number }> = {};

    // For each project, calculate time spent in each status
    projects.forEach(project => {
      const projectHistory = statusHistory
        .filter(h => h.project_id === project.id)
        .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

      for (let i = 0; i < projectHistory.length; i++) {
        const current = projectHistory[i];
        const next = projectHistory[i + 1];
        const statusName = current.status?.name;

        if (!statusName || statusName === 'Invoiced') continue;

        const startDate = new Date(current.changed_at);
        const endDate = next ? new Date(next.changed_at) : new Date();
        const daysInStatus = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (!statusTimes[statusName]) {
          statusTimes[statusName] = { totalDays: 0, count: 0 };
        }
        statusTimes[statusName].totalDays += daysInStatus;
        statusTimes[statusName].count++;
      }
    });

    // Calculate averages and sort by display order
    return statuses
      .filter(s => s.name !== 'Invoiced')
      .map(status => ({
        name: status.name,
        avgDays: statusTimes[status.name]
          ? Math.round(statusTimes[status.name].totalDays / statusTimes[status.name].count)
          : 0,
        displayOrder: status.display_order
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [projects, statusHistory, statuses]);

  // 5. Throughput Trend - Projects completed per month (last 6 months)
  const throughputTrend = useMemo(() => {
    const result: { month: string; completed: number; revenue: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthStr = format(date, 'MMM');

      const completedInMonth = statusHistory.filter(h => {
        if (h.status?.name !== 'Invoiced') return false;
        const changedAt = new Date(h.changed_at);
        return changedAt >= monthStart && changedAt <= monthEnd;
      });

      result.push({
        month: monthStr,
        completed: completedInMonth.length,
        revenue: completedInMonth.reduce((sum, h) => sum + (h.project?.sales_amount || 0), 0)
      });
    }

    return result;
  }, [statusHistory]);

  // 6. PO Velocity vs Invoice Velocity (last 6 months)
  const velocityComparison = useMemo(() => {
    const result: { month: string; posReceived: number; invoiced: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthStr = format(date, 'MMM');

      // POs received (projects created)
      const posInMonth = projects.filter(p => {
        if (!p.created_at) return false;
        const createdAt = new Date(p.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      });

      // Invoiced
      const invoicedInMonth = statusHistory.filter(h => {
        if (h.status?.name !== 'Invoiced') return false;
        const changedAt = new Date(h.changed_at);
        return changedAt >= monthStart && changedAt <= monthEnd;
      });

      result.push({
        month: monthStr,
        posReceived: posInMonth.length,
        invoiced: invoicedInMonth.length
      });
    }

    // Calculate if backlog is growing or shrinking
    const totalPOs = result.reduce((sum, r) => sum + r.posReceived, 0);
    const totalInvoiced = result.reduce((sum, r) => sum + r.invoiced, 0);
    const netChange = totalPOs - totalInvoiced;

    return { monthly: result, totalPOs, totalInvoiced, netChange };
  }, [projects, statusHistory]);

  // ============================================
  // TIER 3 METRICS
  // ============================================

  // 9. Customer Concentration Risk - % revenue from top 3 clients
  const customerConcentration = useMemo(() => {
    // Group projects by client
    const clientRevenue: Record<string, number> = {};

    projectsInProgress.forEach(p => {
      const client = p.client_name || 'Unknown';
      clientRevenue[client] = (clientRevenue[client] || 0) + (p.sales_amount || 0);
    });

    // Sort by revenue and get top 3
    const sortedClients = Object.entries(clientRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const top3 = sortedClients.slice(0, 3);
    const top3Revenue = top3.reduce((sum, c) => sum + c.revenue, 0);
    const totalRevenue = sortedClients.reduce((sum, c) => sum + c.revenue, 0);
    const concentrationPercent = totalRevenue > 0 ? (top3Revenue / totalRevenue) * 100 : 0;

    // Risk levels using configurable thresholds
    let riskLevel: 'low' | 'medium' | 'high';
    if (concentrationPercent < thresholds.concentrationMediumThreshold) riskLevel = 'low';
    else if (concentrationPercent < thresholds.concentrationHighThreshold) riskLevel = 'medium';
    else riskLevel = 'high';

    return {
      top3,
      top3Revenue,
      totalRevenue,
      concentrationPercent,
      riskLevel,
      totalClients: sortedClients.length
    };
  }, [projectsInProgress, thresholds.concentrationMediumThreshold, thresholds.concentrationHighThreshold]);

  // Helper component for trend indicator
  const TrendIndicator = ({ current, previous }: { current: number; previous: number }) => {
    if (previous === 0) return <span className="text-xs text-muted-foreground">-</span>;
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    const isNeutral = Math.abs(change) < 1;

    return (
      <span className={`flex items-center gap-1 text-xs ${isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isNeutral ? <Minus className="h-3 w-3" /> : isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(change).toFixed(0)}% vs prev
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-[100px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getPeriodOptions().map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ROW 1: Revenue Progress + 8 Mini Metrics */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Revenue Progress - spans 3 cols */}
        <Card className="lg:col-span-3 border-[#023A2D]">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-[#023A2D]">
              <DollarSign className="h-4 w-4" />
              {periodType === 'month' ? 'Monthly' : periodType === 'quarter' ? 'Quarterly' : 'Yearly'} Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold text-[#023A2D]">${posReceivedRevenue.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">/ ${periodGoal.revenue.toLocaleString()}</span>
                </div>
                <Progress value={posReceivedProgress} className="h-2" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">POs Received</span>
                  <div className="flex items-center gap-2">
                    <TrendIndicator current={posReceivedRevenue} previous={previousPeriodData.posReceived} />
                    <span className="font-medium">{posReceivedProgress.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-bold text-[#023A2D]">${invoicedRevenue.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">/ ${periodGoal.invoicedRevenue.toLocaleString()}</span>
                </div>
                <Progress value={invoicedRevenueProgress} className="h-2" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Invoiced</span>
                  <div className="flex items-center gap-2">
                    <TrendIndicator current={invoicedRevenue} previous={previousPeriodData.invoiced} />
                    <span className="font-medium">{invoicedRevenueProgress.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 8 Mini Metric Cards - 2x4 grid in 2 cols */}
        <div className="lg:col-span-2 grid grid-cols-4 gap-2">
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">Done</span>
              <CheckCircle className="h-3 w-3 text-green-600" />
            </div>
            <p className="text-lg font-bold">{projectsCompletedCount}</p>
            <TrendIndicator current={projectsCompletedCount} previous={projectsCompletedPrevCount} />
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">Active</span>
              <FolderKanban className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold">{projectsInProgress.length}</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">Pipeline</span>
              <DollarSign className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold">${(pipelineRevenue / 1000).toFixed(0)}K</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">DTI</span>
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold">{avgDaysToInvoice || '-'}d</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">Backlog</span>
              <Layers className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold">{backlogDepth.monthsOfWork}mo</p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">On-Time</span>
              <Target className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className={`text-lg font-bold ${onTimeCompletion.percentage >= thresholds.ontimeGoodThreshold ? 'text-green-600' : onTimeCompletion.percentage >= thresholds.ontimeWarningThreshold ? 'text-amber-600' : 'text-red-600'}`}>
              {onTimeCompletion.percentage.toFixed(0)}%
            </p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">Stuck</span>
              <Timer className="h-3 w-3 text-amber-600" />
            </div>
            <p className={`text-lg font-bold ${wipAgingData.totalStuck > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {wipAgingData.totalStuck}
            </p>
          </Card>
          <Card className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase">Conc.</span>
              <Users className={`h-3 w-3 ${customerConcentration.riskLevel === 'high' ? 'text-red-600' : customerConcentration.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <p className={`text-lg font-bold ${customerConcentration.riskLevel === 'high' ? 'text-red-600' : customerConcentration.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
              {customerConcentration.concentrationPercent.toFixed(0)}%
            </p>
          </Card>
        </div>
      </div>

      {/* ROW 2: Health Diagnostic + Overdue/WIP Alerts */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Health Diagnostic - Compact */}
        <Card className={`border-l-4 ${
          diagnosticData.diagnosis === 'healthy' ? 'border-l-green-500' :
          diagnosticData.diagnosis === 'sales' ? 'border-l-amber-500' :
          diagnosticData.diagnosis === 'operations' ? 'border-l-red-500' :
          'border-l-red-600'
        }`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${
                diagnosticData.diagnosis === 'healthy' ? 'text-green-500' :
                diagnosticData.diagnosis === 'sales' ? 'text-amber-500' :
                'text-red-500'
              }`} />
              Health: {diagnosticData.diagnosis === 'healthy' ? 'OK' : diagnosticData.diagnosis === 'sales' ? 'Sales ⚠' : diagnosticData.diagnosis === 'operations' ? 'Ops ⚠' : 'Both ⚠'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Sales</span>
                  <span className={`font-bold ${diagnosticData.salesHealth >= diagnosticData.salesThreshold ? 'text-green-600' : 'text-amber-600'}`}>
                    {diagnosticData.salesHealth.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(diagnosticData.salesHealth, 100)} className={`h-1.5 ${diagnosticData.salesHealth >= diagnosticData.salesThreshold ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`} />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Ops</span>
                  <span className={`font-bold ${diagnosticData.completionRatio >= diagnosticData.opsThreshold ? 'text-green-600' : 'text-amber-600'}`}>
                    {diagnosticData.completionRatio.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(diagnosticData.completionRatio, 100)} className={`h-1.5 ${diagnosticData.completionRatio >= diagnosticData.opsThreshold ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`} />
              </div>
            </div>
            {(diagnosticData.projectsInProcurement > 0 || diagnosticData.projectsInEngineering > 0) && (
              <div className="flex gap-2 text-xs pt-1">
                {diagnosticData.projectsInProcurement > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded">
                    Proc: {diagnosticData.projectsInProcurement}
                  </span>
                )}
                {diagnosticData.projectsInEngineering > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded">
                    Eng: {diagnosticData.projectsInEngineering}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Projects - Compact */}
        <Card className={overdueProjects.length > 0 ? 'border-l-4 border-l-red-500' : ''}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${overdueProjects.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              Overdue: {overdueProjects.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {overdueProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No overdue projects</p>
            ) : (
              <div className="space-y-1.5">
                {overdueProjects.slice(0, 3).map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
                    <span className="font-medium truncate max-w-[120px]">{p.client_name}</span>
                    <span className="text-red-600">${(p.sales_amount || 0).toLocaleString()}</span>
                  </Link>
                ))}
                {overdueProjects.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{overdueProjects.length - 3} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* WIP Aging - Compact */}
        <Card className={wipAgingData.totalStuck > 0 ? 'border-l-4 border-l-amber-500' : ''}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className={`h-4 w-4 ${wipAgingData.totalStuck > 0 ? 'text-amber-600' : 'text-green-500'}`} />
              Stuck (&gt;{wipAgingData.thresholdDays}d): {wipAgingData.totalStuck}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {wipAgingData.totalStuck === 0 ? (
              <p className="text-xs text-muted-foreground">No stuck projects</p>
            ) : (
              <div className="space-y-1.5">
                {wipAgingData.stuckProjects.slice(0, 3).map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
                    <span className="font-medium truncate max-w-[100px]">{p.client_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{p.statusName}</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] px-1 py-0">
                        {p.daysInStatus}d
                      </Badge>
                    </div>
                  </Link>
                ))}
                {wipAgingData.totalStuck > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{wipAgingData.totalStuck - 3} more (${wipAgingData.totalStuckRevenue.toLocaleString()})</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 3: Velocity + Status Distribution */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Velocity Chart - Compact */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Velocity (6mo)
              </span>
              <span className={`text-xs ${velocityComparison.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Net: {velocityComparison.netChange >= 0 ? '+' : ''}{velocityComparison.netChange}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-6 gap-1">
              {velocityComparison.monthly.map(month => (
                <div key={month.month} className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{month.month}</p>
                  <div className="space-y-0.5">
                    <div className="h-8 bg-muted rounded-sm flex flex-col justify-end overflow-hidden">
                      <div className="bg-blue-500" style={{ height: `${Math.min((month.posReceived / Math.max(...velocityComparison.monthly.map(m => Math.max(m.posReceived, m.invoiced)), 1)) * 100, 100)}%` }} />
                    </div>
                    <div className="h-8 bg-muted rounded-sm flex flex-col justify-end overflow-hidden">
                      <div className="bg-green-500" style={{ height: `${Math.min((month.invoiced / Math.max(...velocityComparison.monthly.map(m => Math.max(m.posReceived, m.invoiced)), 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /> POs: {velocityComparison.totalPOs}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Inv: {velocityComparison.totalInvoiced}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution - Compact */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {statusDistribution.slice(0, 6).map(status => (
                <div key={status.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="truncate max-w-[80px]">{status.name}</span>
                  </div>
                  <span className="font-medium">{status.count}</span>
                </div>
              ))}
            </div>
            {statusDistribution.length > 0 && (
              <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                <span className="text-muted-foreground">Total Active</span>
                <span className="font-bold">{statusDistribution.reduce((sum, s) => sum + s.count, 0)} projects</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 4: Cycle Time + Recently Invoiced + Customer Concentration */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Cycle Time - Compact */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Cycle Time
              </span>
              <span className="text-xs font-bold">{cycleTimeBreakdown.reduce((sum, s) => sum + s.avgDays, 0)}d avg</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {cycleTimeBreakdown.slice(0, 5).map(status => {
                const maxDays = Math.max(...cycleTimeBreakdown.map(s => s.avgDays), 1);
                const isBottleneck = status.name.toLowerCase().includes('procurement') || status.name.toLowerCase().includes('engineering');
                return (
                  <div key={status.name} className="flex items-center gap-2 text-xs">
                    <span className={`w-20 truncate ${isBottleneck ? 'font-medium' : ''}`}>{status.name}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isBottleneck ? 'bg-amber-500' : 'bg-[#023A2D]'}`} style={{ width: `${(status.avgDays / maxDays) * 100}%` }} />
                    </div>
                    <span className={`w-8 text-right font-mono ${isBottleneck ? 'font-bold text-amber-600' : ''}`}>{status.avgDays}d</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recently Invoiced - Compact */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Recently Invoiced
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {lastInvoiced.length === 0 ? (
              <p className="text-xs text-muted-foreground">No invoiced projects yet</p>
            ) : (
              <div className="space-y-1.5">
                {lastInvoiced.map(h => (
                  <Link key={h.id} href={`/projects/${h.project_id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
                    <span className="font-medium truncate max-w-[120px]">{h.project?.client_name}</span>
                    <span className="text-green-600 font-medium">${(h.project?.sales_amount || 0).toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Concentration - Compact */}
        <Card className={`border-l-4 ${
          customerConcentration.riskLevel === 'high' ? 'border-l-red-500' :
          customerConcentration.riskLevel === 'medium' ? 'border-l-amber-500' :
          'border-l-green-500'
        }`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Clients
              </span>
              <Badge variant={customerConcentration.riskLevel === 'high' ? 'destructive' : customerConcentration.riskLevel === 'medium' ? 'secondary' : 'outline'} className="text-[10px]">
                {customerConcentration.concentrationPercent.toFixed(0)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1.5">
              {customerConcentration.top3.map((client, i) => {
                const percent = customerConcentration.totalRevenue > 0 ? (client.revenue / customerConcentration.totalRevenue) * 100 : 0;
                return (
                  <div key={client.name} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">#{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{client.name}</span>
                    <span>{percent.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{customerConcentration.totalClients} total clients</p>
          </CardContent>
        </Card>
      </div>

      {/* ROW 5: Revenue Pipeline - Compact */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue Pipeline (Next 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <LazyRevenueChart data={revenueByMonth} />
        </CardContent>
      </Card>
    </div>
  );
}
