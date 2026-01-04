'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DollarSign,
  FolderKanban,
  Clock,
  CheckCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Timer,
  Layers,
  Target,
  Users,
  BarChart3,
  Activity,
  ChevronLeft,
  ChevronRight,
  Info,
  HelpCircle,
  CalendarX,
  Receipt,
} from 'lucide-react';
import { LazyRevenueChart } from '@/components/dashboard/lazy-charts';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import type { DashboardData } from '@/app/actions/dashboard';

type PeriodType = 'month' | 'quarter' | 'ytd' | 'last12';

// Format currency as millions/thousands
function formatCurrency(value: number, showCents = false): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else if (showCents) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toLocaleString()}`;
}

// Metric tooltip descriptions
const METRIC_TOOLTIPS = {
  posReceived: {
    title: 'POs Received',
    description: 'Total value of purchase orders received this period. This is your primary sales metric - measures how much new business is coming in.',
    why: 'Tracks sales performance against monthly/quarterly targets. Leading indicator of future revenue.',
  },
  invoiced: {
    title: 'Invoiced Revenue',
    description: 'Revenue from projects that have been completed and invoiced to customers this period.',
    why: 'Measures operational throughput - how much work is being completed and converted to billable revenue.',
  },
  completed: {
    title: 'Projects Completed',
    description: 'Number of projects moved to Invoiced status this period.',
    why: 'Measures operational capacity and throughput. Useful for capacity planning and identifying bottlenecks.',
  },
  active: {
    title: 'Active Projects',
    description: 'Total projects currently in progress (not yet invoiced).',
    why: 'Indicates current workload. Too few = potential capacity; too many = potential overload.',
  },
  pipeline: {
    title: 'Pipeline Value',
    description: 'Total dollar value of all active projects in the system.',
    why: 'Represents committed future revenue. Important for cash flow forecasting and resource planning.',
  },
  dti: {
    title: 'Days to Invoice (DTI)',
    description: 'Average number of days from PO receipt to project invoicing across all completed projects.',
    why: 'Key efficiency metric. Lower DTI = faster cash conversion cycle. Industry avg: 30-60 days.',
  },
  backlog: {
    title: 'Backlog Depth',
    description: 'Months of work in queue, calculated as: Pipeline Value ÷ Average Monthly Invoiced Revenue (6mo).',
    why: 'Capacity planning metric. >6 months may indicate need for more resources; <2 months may signal sales issue.',
  },
  onTime: {
    title: 'On-Time Completion %',
    description: 'Percentage of projects invoiced on or before their goal completion date.',
    why: 'Customer satisfaction indicator. Industry benchmark: 80%+ is healthy. <60% needs immediate attention.',
  },
  stuck: {
    title: 'Stuck Projects',
    description: `Projects that have been in their current status for more than the threshold days (default: 14 days).`,
    why: 'Early warning for bottlenecks. Stuck projects often indicate process issues, missing info, or resource constraints.',
  },
  concentration: {
    title: 'Customer Concentration',
    description: 'Percentage of pipeline revenue from your top 3 clients.',
    why: 'Risk indicator. >70% = high risk (client loss impact); <50% = healthy diversification.',
  },
  salesHealth: {
    title: 'Sales Health',
    description: 'POs Received vs Monthly Goal, as a percentage.',
    why: 'Answers "Is sales bringing in enough new business?" <80% indicates sales pipeline needs attention.',
  },
  opsHealth: {
    title: 'Operations Health',
    description: 'Invoiced Revenue vs POs Received ratio.',
    why: 'Answers "Is operations keeping up with sales?" <60% indicates bottleneck in delivery.',
  },
  cycleTime: {
    title: 'Cycle Time by Status',
    description: 'Average days projects spend in each status before moving to the next.',
    why: 'Identifies where projects slow down. Highlighted statuses (Procurement, Engineering) are common bottlenecks.',
  },
  velocity: {
    title: 'PO vs Invoice Velocity',
    description: 'Comparison of projects received vs projects completed over the last 6 months.',
    why: 'If POs > Invoiced, backlog is growing. If Invoiced > POs, backlog is shrinking (good for delivery, watch sales).',
  },
  lowInvoice: {
    title: 'Low Invoice Warning',
    description: 'Alert when the current month is on pace to miss the invoiced revenue goal.',
    why: 'Early warning to take action before month-end. Based on pace of invoicing so far this month.',
  },
  notScheduled: {
    title: 'Projects Not Scheduled',
    description: 'Projects that have been waiting for scheduling beyond the threshold (default: 14 days).',
    why: 'Ensures projects don\'t sit idle without a plan. Helps identify process bottlenecks early.',
  },
  bottleneckSummary: {
    title: 'Bottleneck Summary',
    description: 'Projects stuck in key bottleneck statuses: Engineering Review, In Procurement, and Hold.',
    why: 'Quick view of where work is piling up. Helps prioritize clearing blockages.',
  },
};

// Metric Tooltip Helper Component
function MetricTooltip({
  metric,
  children
}: {
  metric: keyof typeof METRIC_TOOLTIPS;
  children: React.ReactNode;
}) {
  const tip = METRIC_TOOLTIPS[metric];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] p-3">
        <div className="space-y-1.5">
          <p className="font-semibold text-sm">{tip.title}</p>
          <p className="text-xs opacity-90">{tip.description}</p>
          <p className="text-xs text-green-400 italic">Why it matters: {tip.why}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface DashboardContentProps {
  initialData: DashboardData;
}

export function DashboardContent({ initialData }: DashboardContentProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  // Expanded sections state
  const [expandedOverdue, setExpandedOverdue] = useState(false);
  const [expandedStuck, setExpandedStuck] = useState(false);
  const [expandedNotScheduled, setExpandedNotScheduled] = useState(false);

  // Use data from server
  const { projects, statuses, statusHistory, goals, thresholds } = initialData;

  // Get period display label
  const getPeriodLabel = () => {
    const now = new Date();
    if (periodType === 'month') {
      const date = new Date(selectedYear, selectedMonth - 1, 1);
      const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
      return isCurrentMonth ? `This Month (${format(date, 'MMM yyyy')})` : format(date, 'MMMM yyyy');
    } else if (periodType === 'quarter') {
      const isCurrentQuarter = selectedYear === now.getFullYear() && selectedQuarter === Math.floor(now.getMonth() / 3) + 1;
      return isCurrentQuarter ? `This Quarter (Q${selectedQuarter} ${selectedYear})` : `Q${selectedQuarter} ${selectedYear}`;
    } else if (periodType === 'ytd') {
      return `Year to Date (${selectedYear})`;
    } else {
      return 'Last 12 Months';
    }
  };

  // Get date range for selected period
  const getDateRange = () => {
    const now = new Date();

    if (periodType === 'month') {
      const date = new Date(selectedYear, selectedMonth - 1, 1);
      return { start: startOfMonth(date), end: endOfMonth(date) };
    } else if (periodType === 'quarter') {
      const quarterMonth = (selectedQuarter - 1) * 3;
      const date = new Date(selectedYear, quarterMonth, 1);
      return { start: startOfQuarter(date), end: endOfQuarter(date) };
    } else if (periodType === 'ytd') {
      return { start: startOfYear(new Date(selectedYear, 0, 1)), end: now };
    } else {
      // Last 12 months
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return { start: startOfMonth(start), end: now };
    }
  };

  // Get months for the calendar grid
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const quarters = [
    { q: 1, months: [1, 2, 3] },
    { q: 2, months: [4, 5, 6] },
    { q: 3, months: [7, 8, 9] },
    { q: 4, months: [10, 11, 12] },
  ];

  // Handle quick select
  const handleQuickSelect = (type: PeriodType) => {
    const now = new Date();
    setPeriodType(type);
    if (type === 'month') {
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth() + 1);
    } else if (type === 'quarter') {
      setSelectedYear(now.getFullYear());
      setSelectedQuarter(Math.floor(now.getMonth() / 3) + 1);
    } else if (type === 'ytd') {
      setSelectedYear(now.getFullYear());
    }
    setPeriodPickerOpen(false);
  };

  // Handle month click
  const handleMonthClick = (month: number) => {
    setPeriodType('month');
    setSelectedMonth(month);
    setPeriodPickerOpen(false);
  };

  // Handle quarter click
  const handleQuarterClick = (quarter: number) => {
    setPeriodType('quarter');
    setSelectedQuarter(quarter);
    setPeriodPickerOpen(false);
  };

  // Calculate stats for selected period - memoize expensive calculations
  const dateRange = useMemo(() => getDateRange(), [periodType, selectedYear, selectedMonth, selectedQuarter]);
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
      const goal = goals.find(g => g.year === selectedYear && g.month === selectedMonth);
      return {
        revenue: goal?.revenue_goal || 0,
        invoicedRevenue: goal?.invoiced_revenue_goal || 0
      };
    } else if (periodType === 'quarter') {
      const startMonth = (selectedQuarter - 1) * 3 + 1;
      let revenue = 0;
      let invoicedRevenueGoal = 0;
      for (let m = startMonth; m < startMonth + 3; m++) {
        const goal = goals.find(g => g.year === selectedYear && g.month === m);
        revenue += goal?.revenue_goal || 0;
        invoicedRevenueGoal += goal?.invoiced_revenue_goal || 0;
      }
      return { revenue, invoicedRevenue: invoicedRevenueGoal };
    } else if (periodType === 'ytd') {
      const now = new Date();
      const endMonth = selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12;
      let revenue = 0;
      let invoicedRevenueGoal = 0;
      for (let m = 1; m <= endMonth; m++) {
        const goal = goals.find(g => g.year === selectedYear && g.month === m);
        revenue += goal?.revenue_goal || 0;
        invoicedRevenueGoal += goal?.invoiced_revenue_goal || 0;
      }
      return { revenue, invoicedRevenue: invoicedRevenueGoal };
    } else {
      // Last 12 months
      const now = new Date();
      let revenue = 0;
      let invoicedRevenueGoal = 0;
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const goal = goals.find(g => g.year === date.getFullYear() && g.month === date.getMonth() + 1);
        revenue += goal?.revenue_goal || 0;
        invoicedRevenueGoal += goal?.invoiced_revenue_goal || 0;
      }
      return { revenue, invoicedRevenue: invoicedRevenueGoal };
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, goals]);
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
  const getPreviousPeriod = (): { start: Date; end: Date } => {
    if (periodType === 'month') {
      const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
      return { start: startOfMonth(prevDate), end: endOfMonth(prevDate) };
    } else if (periodType === 'quarter') {
      const prevQuarter = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
      const prevYear = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
      const prevMonth = (prevQuarter - 1) * 3;
      const prevDate = new Date(prevYear, prevMonth, 1);
      return { start: startOfQuarter(prevDate), end: endOfQuarter(prevDate) };
    } else if (periodType === 'ytd') {
      // Previous year YTD
      const now = new Date();
      const endMonth = selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12;
      const prevYearStart = startOfYear(new Date(selectedYear - 1, 0, 1));
      const prevYearEnd = new Date(selectedYear - 1, endMonth - 1, new Date(selectedYear - 1, endMonth, 0).getDate());
      return { start: prevYearStart, end: prevYearEnd };
    } else {
      // Previous 12 months (12-24 months ago)
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 23, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - 12, 0);
      return { start: startOfMonth(start), end };
    }
  };

  // Previous period calculations for comparison
  const previousPeriodData = useMemo(() => {
    const prevRange = getPreviousPeriod();

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
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, projects, statusHistory]);

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

  // ============================================
  // NEW ALERT METRICS
  // ============================================

  // Low Invoice Month Warning - Calculate projected month-end invoicing
  const lowInvoiceWarning = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Get current month's goal
    const monthGoal = goals.find(g => g.year === currentYear && g.month === currentMonth);
    const invoicedGoal = monthGoal?.invoiced_revenue_goal || 0;

    // Get invoiced revenue so far this month
    const monthStart = startOfMonth(now);
    const invoicedThisMonth = statusHistory.filter(h => {
      if (h.status?.name !== 'Invoiced') return false;
      const changedAt = new Date(h.changed_at);
      return changedAt >= monthStart;
    });
    const currentInvoiced = invoicedThisMonth.reduce((sum, h) => sum + (h.project?.sales_amount || 0), 0);

    // Calculate projected month-end based on current pace
    const dailyRate = dayOfMonth > 0 ? currentInvoiced / dayOfMonth : 0;
    const projectedMonthEnd = dailyRate * daysInMonth;

    // Calculate percentage of goal
    const projectedPercent = invoicedGoal > 0 ? (projectedMonthEnd / invoicedGoal) * 100 : 100;
    const currentPercent = invoicedGoal > 0 ? (currentInvoiced / invoicedGoal) * 100 : 100;

    // Determine warning level
    const warningThreshold = thresholds.lowInvoiceWarningPercent;
    const isWarning = projectedPercent < warningThreshold;
    const isCritical = projectedPercent < 60;

    return {
      currentInvoiced,
      projectedMonthEnd,
      invoicedGoal,
      projectedPercent,
      currentPercent,
      dayOfMonth,
      daysInMonth,
      daysRemaining: daysInMonth - dayOfMonth,
      isWarning,
      isCritical,
      warningThreshold
    };
  }, [statusHistory, goals, thresholds.lowInvoiceWarningPercent]);

  // Projects Not Scheduled - Find projects waiting too long without being scheduled
  const projectsNotScheduled = useMemo(() => {
    const today = new Date();
    const warningDays = thresholds.notScheduledWarningDays;

    // Find statuses that are pre-scheduling
    const preSchedulingStatuses = statuses.filter(s =>
      s.name === 'PO Received' ||
      s.name.toLowerCase().includes('engineering') ||
      s.name.toLowerCase().includes('procurement') ||
      s.name === 'Pending Scheduling'
    ).map(s => s.id);

    // Find projects in pre-scheduling statuses without a start date or with a far-out start date
    const waitingProjects = projects
      .filter(p => {
        // Must be in a pre-scheduling status
        if (!p.current_status_id || !preSchedulingStatuses.includes(p.current_status_id)) return false;
        // Must not be invoiced
        if (p.current_status_id === invoicedStatus?.id) return false;

        // Check how long since creation
        const createdAt = p.created_at ? new Date(p.created_at) : null;
        if (!createdAt) return false;

        const daysSinceCreation = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceCreation >= warningDays;
      })
      .map(p => {
        const createdAt = p.created_at ? new Date(p.created_at) : today;
        const daysWaiting = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...p,
          daysWaiting,
          statusName: p.current_status?.name || 'Unknown'
        };
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting);

    return {
      projects: waitingProjects,
      count: waitingProjects.length,
      totalRevenue: waitingProjects.reduce((sum, p) => sum + (p.sales_amount || 0), 0),
      warningDays
    };
  }, [projects, statuses, invoicedStatus, thresholds.notScheduledWarningDays]);

  // Enhanced Bottleneck Summary
  const bottleneckSummary = useMemo(() => {
    const today = new Date();

    // Find bottleneck statuses
    const engineeringStatus = statuses.find(s =>
      s.name.toLowerCase().includes('engineering')
    );
    const procurementStatus = statuses.find(s =>
      s.name.toLowerCase().includes('procurement')
    );
    const holdStatus = statuses.find(s =>
      s.name.toLowerCase() === 'hold'
    );

    const getBottleneckData = (statusId: string | undefined, statusName: string) => {
      if (!statusId) return { count: 0, revenue: 0, avgDays: 0, projects: [] as typeof projects, statusName };

      const projectsInStatus = projects.filter(p => p.current_status_id === statusId);
      const revenue = projectsInStatus.reduce((sum, p) => sum + (p.sales_amount || 0), 0);

      // Calculate average days in this status
      let totalDays = 0;
      let countWithHistory = 0;
      const projectsWithDays = projectsInStatus.map(p => {
        const lastChange = statusHistory.find(h => h.project_id === p.id);
        let daysInStatus = 0;
        if (lastChange) {
          daysInStatus = Math.floor((today.getTime() - new Date(lastChange.changed_at).getTime()) / (1000 * 60 * 60 * 24));
          totalDays += daysInStatus;
          countWithHistory++;
        }
        return { ...p, daysInStatus };
      }).sort((a, b) => b.daysInStatus - a.daysInStatus);

      return {
        count: projectsInStatus.length,
        revenue,
        avgDays: countWithHistory > 0 ? Math.round(totalDays / countWithHistory) : 0,
        projects: projectsWithDays,
        statusName
      };
    };

    const engineering = getBottleneckData(engineeringStatus?.id, 'Engineering Review');
    const procurement = getBottleneckData(procurementStatus?.id, 'In Procurement');
    const hold = getBottleneckData(holdStatus?.id, 'Hold');

    const totalCount = engineering.count + procurement.count + hold.count;
    const totalRevenue = engineering.revenue + procurement.revenue + hold.revenue;

    return {
      engineering,
      procurement,
      hold,
      totalCount,
      totalRevenue,
      hasBottlenecks: totalCount > 0
    };
  }, [projects, statuses, statusHistory]);

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

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  return (
    <div className="space-y-3">
      {/* HERO: Monthly Summary - Most Prominent Metrics */}
      <div className="bg-gradient-to-r from-[#023A2D] to-[#034d3c] rounded-lg p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="grid grid-cols-2 gap-6 sm:gap-10 flex-1">
            {/* Monthly POs Received */}
            <MetricTooltip metric="posReceived">
              <div className="cursor-help">
                <div className="text-xs sm:text-sm text-white/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                  {periodType === 'month' ? 'Monthly' : periodType === 'quarter' ? 'Quarterly' : periodType === 'ytd' ? 'YTD' : '12mo'} POs Received
                  <HelpCircle className="h-3 w-3 opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-5xl font-bold tracking-tight">{formatCurrency(posReceivedRevenue)}</span>
                  {periodGoal.revenue > 0 && (
                    <span className="text-sm sm:text-lg text-white/60">/ {formatCurrency(periodGoal.revenue)}</span>
                  )}
                </div>
                {periodGoal.revenue > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={posReceivedProgress} className="h-2 flex-1 bg-white/20 [&>div]:bg-white" />
                    <span className="text-sm font-semibold">{posReceivedProgress.toFixed(0)}%</span>
                  </div>
                )}
                {compareEnabled && previousPeriodData.posReceived > 0 && (
                  <div className="mt-1">
                    <TrendIndicator current={posReceivedRevenue} previous={previousPeriodData.posReceived} />
                  </div>
                )}
              </div>
            </MetricTooltip>

            {/* Monthly Invoiced */}
            <MetricTooltip metric="invoiced">
              <div className="cursor-help">
                <div className="text-xs sm:text-sm text-white/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                  {periodType === 'month' ? 'Monthly' : periodType === 'quarter' ? 'Quarterly' : periodType === 'ytd' ? 'YTD' : '12mo'} Invoiced
                  <HelpCircle className="h-3 w-3 opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-5xl font-bold tracking-tight">{formatCurrency(invoicedRevenue)}</span>
                  {periodGoal.invoicedRevenue > 0 && (
                    <span className="text-sm sm:text-lg text-white/60">/ {formatCurrency(periodGoal.invoicedRevenue)}</span>
                  )}
                </div>
                {periodGoal.invoicedRevenue > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={invoicedRevenueProgress} className="h-2 flex-1 bg-white/20 [&>div]:bg-white" />
                    <span className="text-sm font-semibold">{invoicedRevenueProgress.toFixed(0)}%</span>
                  </div>
                )}
                {compareEnabled && previousPeriodData.invoiced > 0 && (
                  <div className="mt-1">
                    <TrendIndicator current={invoicedRevenue} previous={previousPeriodData.invoiced} />
                  </div>
                )}
              </div>
            </MetricTooltip>
          </div>

          {/* Period Selector */}
          <Popover open={periodPickerOpen} onOpenChange={setPeriodPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" className="h-9 px-3 gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{getPeriodLabel()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="end">
              {/* Year Navigation */}
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold">{selectedYear}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick Select */}
              <div className="p-3 border-b space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Quick Select</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={periodType === 'month' && selectedMonth === currentMonth && selectedYear === now.getFullYear() ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleQuickSelect('month')}
                  >
                    This Month
                  </Button>
                  <Button
                    variant={periodType === 'quarter' && selectedQuarter === currentQuarter && selectedYear === now.getFullYear() ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleQuickSelect('quarter')}
                  >
                    This Quarter
                  </Button>
                  <Button
                    variant={periodType === 'ytd' && selectedYear === now.getFullYear() ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleQuickSelect('ytd')}
                  >
                    Year to Date
                  </Button>
                  <Button
                    variant={periodType === 'last12' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleQuickSelect('last12')}
                  >
                    Last 12 Mo
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="p-3">
                <div className="grid grid-cols-4 gap-1">
                  {quarters.map((quarter) => (
                    <div key={quarter.q} className="space-y-1">
                      {/* Quarter Header */}
                      <button
                        onClick={() => handleQuarterClick(quarter.q)}
                        className={`w-full text-[10px] font-semibold py-1 rounded transition-colors ${
                          periodType === 'quarter' && selectedQuarter === quarter.q && selectedYear === now.getFullYear()
                            ? 'bg-primary text-primary-foreground'
                            : selectedYear === now.getFullYear() && currentQuarter === quarter.q
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Q{quarter.q}
                      </button>
                      {/* Months in Quarter */}
                      {quarter.months.map((monthNum) => (
                        <button
                          key={monthNum}
                          onClick={() => handleMonthClick(monthNum)}
                          className={`w-full text-xs py-1.5 rounded transition-colors ${
                            periodType === 'month' && selectedMonth === monthNum && selectedYear === now.getFullYear()
                              ? 'bg-primary text-primary-foreground'
                              : selectedYear === now.getFullYear() && currentMonth === monthNum
                              ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {months[monthNum - 1]}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Compare Toggle */}
              <div className="px-3 py-2 border-t">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={compareEnabled}
                    onCheckedChange={(checked) => setCompareEnabled(checked === true)}
                  />
                  <span className="text-muted-foreground">Compare to previous period</span>
                </label>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ROW 1: 8 Mini Metrics - Full width grid */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          <MetricTooltip metric="completed">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">Done</span>
                <CheckCircle className="h-3 w-3 text-green-600" />
              </div>
              <p className="text-lg font-bold">{projectsCompletedCount}</p>
              {compareEnabled && <TrendIndicator current={projectsCompletedCount} previous={projectsCompletedPrevCount} />}
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="active">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">Active</span>
                <FolderKanban className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{projectsInProgress.length}</p>
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="pipeline">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">WIP Pipeline</span>
                <DollarSign className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{formatCurrency(pipelineRevenue)}</p>
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="dti">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">DTI</span>
                <Clock className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{avgDaysToInvoice || '-'}d</p>
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="backlog">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">Backlog</span>
                <Layers className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{backlogDepth.monthsOfWork}mo</p>
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="onTime">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">On-Time</span>
                <Target className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className={`text-lg font-bold ${onTimeCompletion.percentage >= thresholds.ontimeGoodThreshold ? 'text-green-600' : onTimeCompletion.percentage >= thresholds.ontimeWarningThreshold ? 'text-amber-600' : 'text-red-600'}`}>
                {onTimeCompletion.percentage.toFixed(0)}%
              </p>
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="stuck">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">Stuck</span>
                <Timer className="h-3 w-3 text-amber-600" />
              </div>
              <p className={`text-lg font-bold ${wipAgingData.totalStuck > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {wipAgingData.totalStuck}
              </p>
            </Card>
          </MetricTooltip>
          <MetricTooltip metric="concentration">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">Conc.</span>
                <Users className={`h-3 w-3 ${customerConcentration.riskLevel === 'high' ? 'text-red-600' : customerConcentration.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
              <p className={`text-lg font-bold ${customerConcentration.riskLevel === 'high' ? 'text-red-600' : customerConcentration.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
                {customerConcentration.concentrationPercent.toFixed(0)}%
              </p>
            </Card>
          </MetricTooltip>
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
              <MetricTooltip metric="salesHealth">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">Sales <HelpCircle className="h-2.5 w-2.5 opacity-50" /></span>
                    <span className={`font-bold ${diagnosticData.salesHealth >= diagnosticData.salesThreshold ? 'text-green-600' : 'text-amber-600'}`}>
                      {diagnosticData.salesHealth.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(diagnosticData.salesHealth, 100)} className={`h-1.5 ${diagnosticData.salesHealth >= diagnosticData.salesThreshold ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`} />
                </div>
              </MetricTooltip>
              <MetricTooltip metric="opsHealth">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">Ops <HelpCircle className="h-2.5 w-2.5 opacity-50" /></span>
                    <span className={`font-bold ${diagnosticData.completionRatio >= diagnosticData.opsThreshold ? 'text-green-600' : 'text-amber-600'}`}>
                      {diagnosticData.completionRatio.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(diagnosticData.completionRatio, 100)} className={`h-1.5 ${diagnosticData.completionRatio >= diagnosticData.opsThreshold ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`} />
                </div>
              </MetricTooltip>
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
                {(expandedOverdue ? overdueProjects : overdueProjects.slice(0, 3)).map(p => (
                  <Link key={p.id} href={`/projects/${p.sales_order_number || p.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
                    <span className="font-medium truncate max-w-[120px]">{p.client_name}</span>
                    <span className="text-red-600">{formatCurrency(p.sales_amount || 0)}</span>
                  </Link>
                ))}
                {overdueProjects.length > 3 && (
                  <button
                    onClick={() => setExpandedOverdue(!expandedOverdue)}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {expandedOverdue ? 'Show less' : `+${overdueProjects.length - 3} more`}
                  </button>
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
                {(expandedStuck ? wipAgingData.stuckProjects : wipAgingData.stuckProjects.slice(0, 3)).map(p => (
                  <Link key={p.id} href={`/projects/${p.sales_order_number || p.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
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
                  <button
                    onClick={() => setExpandedStuck(!expandedStuck)}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {expandedStuck ? 'Show less' : `+${wipAgingData.totalStuck - 3} more (${formatCurrency(wipAgingData.totalStuckRevenue)})`}
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 2B: New Alerts - Low Invoice Warning, Not Scheduled, Bottleneck Summary */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Low Invoice Month Warning */}
        {lowInvoiceWarning.invoicedGoal > 0 && (
          <Card className={`${lowInvoiceWarning.isCritical ? 'border-l-4 border-l-red-500' : lowInvoiceWarning.isWarning ? 'border-l-4 border-l-amber-500' : ''}`}>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MetricTooltip metric="lowInvoice">
                  <span className="flex items-center gap-2 cursor-help">
                    <Receipt className={`h-4 w-4 ${lowInvoiceWarning.isCritical ? 'text-red-500' : lowInvoiceWarning.isWarning ? 'text-amber-500' : 'text-green-500'}`} />
                    Invoice Pace
                    <HelpCircle className="h-3 w-3 opacity-50" />
                  </span>
                </MetricTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {lowInvoiceWarning.isWarning ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-lg font-bold ${lowInvoiceWarning.isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                      {lowInvoiceWarning.projectedPercent.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">projected</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    On pace for {formatCurrency(lowInvoiceWarning.projectedMonthEnd)} of {formatCurrency(lowInvoiceWarning.invoicedGoal)} goal
                  </p>
                  <div className="flex justify-between text-xs">
                    <span>Current: {formatCurrency(lowInvoiceWarning.currentInvoiced)}</span>
                    <span>{lowInvoiceWarning.daysRemaining} days left</span>
                  </div>
                  <Progress
                    value={lowInvoiceWarning.currentPercent}
                    className={`h-1.5 ${lowInvoiceWarning.isCritical ? '[&>div]:bg-red-500' : '[&>div]:bg-amber-500'}`}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-green-600">
                      {lowInvoiceWarning.projectedPercent.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">on track</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(lowInvoiceWarning.currentInvoiced)} invoiced, {lowInvoiceWarning.daysRemaining} days left
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Projects Not Scheduled Alert */}
        <Card className={projectsNotScheduled.count > 0 ? 'border-l-4 border-l-amber-500' : ''}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MetricTooltip metric="notScheduled">
                <span className="flex items-center gap-2 cursor-help">
                  <CalendarX className={`h-4 w-4 ${projectsNotScheduled.count > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                  Not Scheduled (&gt;{projectsNotScheduled.warningDays}d)
                  <HelpCircle className="h-3 w-3 opacity-50" />
                </span>
              </MetricTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {projectsNotScheduled.count === 0 ? (
              <p className="text-xs text-muted-foreground">All projects scheduled</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-600 font-medium">
                  {projectsNotScheduled.count} project{projectsNotScheduled.count !== 1 ? 's' : ''} waiting ({formatCurrency(projectsNotScheduled.totalRevenue)})
                </p>
                {(expandedNotScheduled ? projectsNotScheduled.projects : projectsNotScheduled.projects.slice(0, 3)).map(p => (
                  <Link key={p.id} href={`/projects/${p.sales_order_number || p.id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
                    <span className="font-medium truncate max-w-[100px]">{p.client_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground truncate max-w-[60px]">{p.statusName}</span>
                      <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px] px-1 py-0">
                        {p.daysWaiting}d
                      </Badge>
                    </div>
                  </Link>
                ))}
                {projectsNotScheduled.count > 3 && (
                  <button
                    onClick={() => setExpandedNotScheduled(!expandedNotScheduled)}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {expandedNotScheduled ? 'Show less' : `+${projectsNotScheduled.count - 3} more`}
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottleneck Summary Card */}
        <Card className={bottleneckSummary.hasBottlenecks ? 'border-l-4 border-l-blue-500' : ''}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MetricTooltip metric="bottleneckSummary">
                <span className="flex items-center gap-2 cursor-help">
                  <Layers className={`h-4 w-4 ${bottleneckSummary.hasBottlenecks ? 'text-blue-500' : 'text-green-500'}`} />
                  Bottlenecks
                  <HelpCircle className="h-3 w-3 opacity-50" />
                </span>
              </MetricTooltip>
              {bottleneckSummary.hasBottlenecks && (
                <Badge variant="secondary" className="text-[10px]">
                  {bottleneckSummary.totalCount} projects
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {!bottleneckSummary.hasBottlenecks ? (
              <p className="text-xs text-muted-foreground">No bottlenecks detected</p>
            ) : (
              <div className="space-y-2">
                {bottleneckSummary.engineering.count > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Engineering</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bottleneckSummary.engineering.count}</span>
                      <span className="text-muted-foreground">({bottleneckSummary.engineering.avgDays}d avg)</span>
                    </div>
                  </div>
                )}
                {bottleneckSummary.procurement.count > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Procurement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bottleneckSummary.procurement.count}</span>
                      <span className="text-muted-foreground">({bottleneckSummary.procurement.avgDays}d avg)</span>
                    </div>
                  </div>
                )}
                {bottleneckSummary.hold.count > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>Hold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bottleneckSummary.hold.count}</span>
                      <span className="text-muted-foreground">({bottleneckSummary.hold.avgDays}d avg)</span>
                    </div>
                  </div>
                )}
                <div className="pt-1 border-t text-xs text-muted-foreground">
                  Total value: {formatCurrency(bottleneckSummary.totalRevenue)}
                </div>
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
              <MetricTooltip metric="velocity">
                <span className="flex items-center gap-2 cursor-help">
                  <Activity className="h-4 w-4" />
                  Velocity (6mo)
                  <HelpCircle className="h-3 w-3 opacity-50" />
                </span>
              </MetricTooltip>
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
              <MetricTooltip metric="cycleTime">
                <span className="flex items-center gap-2 cursor-help">
                  <Clock className="h-4 w-4" />
                  Cycle Time
                  <HelpCircle className="h-3 w-3 opacity-50" />
                </span>
              </MetricTooltip>
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
                  <Link key={h.id} href={`/projects/${h.project?.sales_order_number || h.project_id}`} className="flex items-center justify-between text-xs hover:bg-muted/50 rounded p-1 -mx-1">
                    <span className="font-medium truncate max-w-[120px]">{h.project?.client_name}</span>
                    <span className="text-green-600 font-medium">{formatCurrency(h.project?.sales_amount || 0)}</span>
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

      {/* ROW 5: Invoice Goal Date by Month */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Invoice Goal Date by Month
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <LazyRevenueChart data={revenueByMonth} />
        </CardContent>
      </Card>
    </div>
  );
}
