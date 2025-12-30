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
    <div className="space-y-4 md:space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Overview of your projects and revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
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

      {/* Current Month Revenue Highlight */}
      <Card className="border-[#023A2D] bg-gradient-to-r from-[#023A2D]/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-[#023A2D]">
            <DollarSign className="h-5 w-5" />
            {periodType === 'month' ? 'Monthly' : periodType === 'quarter' ? 'Quarterly' : 'Yearly'} Revenue Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* POs Received Progress */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-bold text-[#023A2D]">
                  ${posReceivedRevenue.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  of ${periodGoal.revenue.toLocaleString()} goal
                </span>
              </div>
              <Progress value={posReceivedProgress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">POs Received</span>
                <div className="flex items-center gap-3">
                  <TrendIndicator current={posReceivedRevenue} previous={previousPeriodData.posReceived} />
                  <span className="font-medium">{posReceivedProgress.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Projects Invoiced Revenue Progress */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-bold text-[#023A2D]">
                  ${invoicedRevenue.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  of ${periodGoal.invoicedRevenue.toLocaleString()} goal
                </span>
              </div>
              <Progress value={invoicedRevenueProgress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Projects Invoiced</span>
                <div className="flex items-center gap-3">
                  <TrendIndicator current={invoicedRevenue} previous={previousPeriodData.invoiced} />
                  <span className="font-medium">{invoicedRevenueProgress.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Projects - moved up */}
      {overdueProjects.length > 0 && (
        <OverdueProjects
          projects={overdueProjects.map(p => ({
            id: p.id,
            client_name: p.client_name,
            goal_completion_date: p.goal_completion_date || '',
            sales_amount: p.sales_amount,
            current_status: p.current_status,
          }))}
        />
      )}

      {/* Stats Cards - Row 1 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectsCompletedCount}</div>
            <TrendIndicator current={projectsCompletedCount} previous={projectsCompletedPrevCount} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects In Progress</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectsInProgress.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${pipelineRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Days to Invoice</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgDaysToInvoice || '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Row 2 (Tier 1 Metrics) */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backlog Depth</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backlogDepth.monthsOfWork} mo</div>
            <p className="text-xs text-muted-foreground">of work in queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Completion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${onTimeCompletion.percentage >= thresholds.ontimeGoodThreshold ? 'text-green-600' : onTimeCompletion.percentage >= thresholds.ontimeWarningThreshold ? 'text-amber-600' : 'text-red-600'}`}>
              {onTimeCompletion.percentage.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">{onTimeCompletion.onTime} of {onTimeCompletion.total} on time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stuck Projects</CardTitle>
            <Timer className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${wipAgingData.totalStuck > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {wipAgingData.totalStuck}
            </div>
            <p className="text-xs text-muted-foreground">&gt;{wipAgingData.thresholdDays} days in status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Concentration</CardTitle>
            <Users className={`h-4 w-4 ${customerConcentration.riskLevel === 'high' ? 'text-red-600' : customerConcentration.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${customerConcentration.riskLevel === 'high' ? 'text-red-600' : customerConcentration.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
              {customerConcentration.concentrationPercent.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">top 3 of {customerConcentration.totalClients} clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Last 3 Invoiced */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Recently Invoiced
            </CardTitle>
            <CardDescription>Last 3 projects invoiced</CardDescription>
          </CardHeader>
          <CardContent>
            {lastInvoiced.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoiced projects yet</p>
            ) : (
              <div className="space-y-3">
                {lastInvoiced.map(h => (
                  <Link
                    key={h.id}
                    href={`/projects/${h.project_id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{h.project?.client_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(h.changed_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-green-600">
                        ${(h.project?.sales_amount || 0).toLocaleString()}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last 3 Created */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Newly Added
            </CardTitle>
            <CardDescription>Last 3 projects entered</CardDescription>
          </CardHeader>
          <CardContent>
            {lastCreated.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet</p>
            ) : (
              <div className="space-y-3">
                {lastCreated.map(p => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{p.client_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.created_at ? format(new Date(p.created_at), 'MMM d, yyyy') : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.current_status && (
                        <Badge variant="outline">{p.current_status.name}</Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales vs Operations Diagnostic */}
      <Card className={`border-l-4 ${
        diagnosticData.diagnosis === 'healthy' ? 'border-l-green-500' :
        diagnosticData.diagnosis === 'sales' ? 'border-l-amber-500' :
        diagnosticData.diagnosis === 'operations' ? 'border-l-red-500' :
        'border-l-red-600'
      }`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${
              diagnosticData.diagnosis === 'healthy' ? 'text-green-500' :
              diagnosticData.diagnosis === 'sales' ? 'text-amber-500' :
              'text-red-500'
            }`} />
            Health Diagnostic: {
              diagnosticData.diagnosis === 'healthy' ? 'Healthy' :
              diagnosticData.diagnosis === 'sales' ? 'Sales Attention Needed' :
              diagnosticData.diagnosis === 'operations' ? 'Operations Bottleneck' :
              'Both Need Attention'
            }
          </CardTitle>
          <CardDescription>{diagnosticData.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sales Health */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-amber-600" />
                <span className="font-medium">Sales Health (POs vs Goal)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${diagnosticData.salesHealth >= diagnosticData.salesThreshold ? 'text-green-600' : diagnosticData.salesHealth >= diagnosticData.salesThreshold / 2 ? 'text-amber-600' : 'text-red-600'}`}>
                  {diagnosticData.salesHealth.toFixed(0)}%
                </span>
                <span className="text-sm text-muted-foreground">of goal (threshold: {diagnosticData.salesThreshold}%)</span>
              </div>
              <Progress
                value={Math.min(diagnosticData.salesHealth, 100)}
                className={`h-2 ${diagnosticData.salesHealth >= diagnosticData.salesThreshold ? '[&>div]:bg-green-500' : diagnosticData.salesHealth >= diagnosticData.salesThreshold / 2 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`}
              />
            </div>

            {/* Operations Health */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Operations Health (Invoiced vs POs)</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${diagnosticData.completionRatio >= diagnosticData.salesThreshold ? 'text-green-600' : diagnosticData.completionRatio >= diagnosticData.opsThreshold ? 'text-amber-600' : 'text-red-600'}`}>
                  {diagnosticData.completionRatio.toFixed(0)}%
                </span>
                <span className="text-sm text-muted-foreground">completion rate (threshold: {diagnosticData.opsThreshold}%)</span>
              </div>
              <Progress
                value={Math.min(diagnosticData.completionRatio, 100)}
                className={`h-2 ${diagnosticData.completionRatio >= diagnosticData.salesThreshold ? '[&>div]:bg-green-500' : diagnosticData.completionRatio >= diagnosticData.opsThreshold ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`}
              />
            </div>
          </div>

          {/* Bottleneck Details */}
          {(diagnosticData.projectsInProcurement > 0 || diagnosticData.projectsInEngineering > 0) && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-medium mb-3">Bottleneck Areas:</p>
              <div className="grid grid-cols-2 gap-4">
                {diagnosticData.projectsInProcurement > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">Procurement</p>
                      <p className="text-sm text-muted-foreground">{diagnosticData.projectsInProcurement} projects</p>
                    </div>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      ${diagnosticData.revenueInProcurement.toLocaleString()}
                    </span>
                  </div>
                )}
                {diagnosticData.projectsInEngineering > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-700 dark:text-blue-400">Engineering</p>
                      <p className="text-sm text-muted-foreground">{diagnosticData.projectsInEngineering} projects</p>
                    </div>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                      ${diagnosticData.revenueInEngineering.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WIP Aging Alert - Stuck Projects Detail */}
      {wipAgingData.totalStuck > 0 && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-amber-600" />
              Stuck Projects Alert
            </CardTitle>
            <CardDescription>
              {wipAgingData.totalStuck} projects stuck for &gt;{wipAgingData.thresholdDays} days (${wipAgingData.totalStuckRevenue.toLocaleString()} at risk)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(wipAgingData.stuckByStatus).map(([status, data]) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{status}</span>
                    <span className="text-sm text-muted-foreground">
                      {data.count} projects · ${data.revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {data.projects.slice(0, 3).map(project => (
                      <div key={project.id} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
                        <span className="font-medium">{project.client_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">${(project.sales_amount || 0).toLocaleString()}</span>
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            {project.daysInStatus} days
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {data.projects.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{data.projects.length - 3} more projects
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cycle Time Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cycle Time by Status
          </CardTitle>
          <CardDescription>Average days projects spend in each status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cycleTimeBreakdown.map(status => {
              const maxDays = Math.max(...cycleTimeBreakdown.map(s => s.avgDays), 1);
              const widthPercent = (status.avgDays / maxDays) * 100;
              const isBottleneck = status.name.toLowerCase().includes('procurement') ||
                                   status.name.toLowerCase().includes('engineering');
              return (
                <div key={status.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isBottleneck ? 'font-medium' : ''}>{status.name}</span>
                    <span className={`font-mono ${isBottleneck ? 'font-bold text-amber-600' : ''}`}>
                      {status.avgDays} days
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isBottleneck ? 'bg-amber-500' : 'bg-[#023A2D]'
                      }`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total Avg Cycle Time</span>
              <span className="font-mono font-bold">
                {cycleTimeBreakdown.reduce((sum, s) => sum + s.avgDays, 0)} days
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Velocity Comparison - POs vs Invoiced */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              PO vs Invoice Velocity
            </CardTitle>
            <CardDescription>
              Are you keeping up? Net: {velocityComparison.netChange > 0 ? '+' : ''}{velocityComparison.netChange} projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {velocityComparison.monthly.map(month => (
                <div key={month.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{month.month}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-blue-600">{month.posReceived} POs</span>
                      <span className="text-green-600">{month.invoiced} Inv</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className="flex-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min((month.posReceived / Math.max(month.posReceived, month.invoiced, 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min((month.invoiced / Math.max(month.posReceived, month.invoiced, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between text-sm">
              <span className="text-blue-600 font-medium">{velocityComparison.totalPOs} total POs</span>
              <span className="text-green-600 font-medium">{velocityComparison.totalInvoiced} invoiced</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Throughput Trend
            </CardTitle>
            <CardDescription>Projects completed per month (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {throughputTrend.map(month => {
                const maxCompleted = Math.max(...throughputTrend.map(m => m.completed), 1);
                return (
                  <div key={month.month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{month.month}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{month.completed} projects</span>
                        <span className="text-muted-foreground">${month.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(month.completed / maxCompleted) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">6-Month Total</span>
                <span className="font-mono font-bold">
                  {throughputTrend.reduce((sum, m) => sum + m.completed, 0)} projects · ${throughputTrend.reduce((sum, m) => sum + m.revenue, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Concentration Risk Detail */}
      {customerConcentration.totalClients > 0 && (
        <Card className={`border-l-4 ${
          customerConcentration.riskLevel === 'high' ? 'border-l-red-500' :
          customerConcentration.riskLevel === 'medium' ? 'border-l-amber-500' :
          'border-l-green-500'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Concentration: {customerConcentration.riskLevel === 'high' ? 'High Risk' : customerConcentration.riskLevel === 'medium' ? 'Medium Risk' : 'Healthy'}
            </CardTitle>
            <CardDescription>
              Top 3 clients represent {customerConcentration.concentrationPercent.toFixed(0)}% of pipeline revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerConcentration.top3.map((client, i) => {
                const percent = customerConcentration.totalRevenue > 0
                  ? (client.revenue / customerConcentration.totalRevenue) * 100
                  : 0;
                return (
                  <div key={client.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">#{i + 1}</span>
                        <span className="font-medium">{client.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>${client.revenue.toLocaleString()}</span>
                        <span className="text-muted-foreground">({percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          i === 0 ? 'bg-red-500' : i === 1 ? 'bg-amber-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
              {customerConcentration.riskLevel === 'high' && (
                <p>High concentration risk: Consider diversifying client base to reduce dependency.</p>
              )}
              {customerConcentration.riskLevel === 'medium' && (
                <p>Moderate concentration: Monitor top client relationships closely.</p>
              )}
              {customerConcentration.riskLevel === 'low' && (
                <p>Healthy distribution across {customerConcentration.totalClients} clients.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Distribution Chart */}
      {statusDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
            <CardDescription>Where projects are currently in the pipeline (excludes invoiced)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <LazyStatusChart data={statusDistribution} />
              <div className="space-y-3">
                {statusDistribution.map(status => (
                  <div key={status.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <div>
                        <p className="font-medium">{status.name}</p>
                        <p className="text-sm text-muted-foreground">{status.count} projects</p>
                      </div>
                    </div>
                    <span className="font-semibold">${status.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Pipeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Pipeline</CardTitle>
          <CardDescription>Expected revenue by month (based on goal dates)</CardDescription>
        </CardHeader>
        <CardContent>
          <LazyRevenueChart data={revenueByMonth} />
        </CardContent>
      </Card>
    </div>
  );
}
