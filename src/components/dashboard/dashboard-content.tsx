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
  Timer,
  Layers,
  Target,
  Users,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Tv,
} from 'lucide-react';
import { format } from 'date-fns';
import type { DashboardData } from '@/app/actions/dashboard';
import { useUser } from '@/contexts/user-context';
import {
  getDateRange as getDateRangeFromLib,
  getPreviousPeriod as getPreviousPeriodFromLib,
  filterProjectsByInvoicedDate,
  filterProjectsByCreatedDate,
  filterActiveProjects,
  sumRevenue,
  computeGoalsForPeriod,
  computeAvgDaysToInvoice,
  type PeriodParams,
  type ExcludedStatusIds,
} from '@/lib/metrics';
import { useMyTodos, useToggleTodo } from '@/hooks/queries/use-l10-todos';
import type { MyTodoWithTeam } from '@/app/(dashboard)/l10/todos-actions';
import { ExternalLink, ListChecks } from 'lucide-react';

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
  vidpodSales: {
    title: 'VidPOD Sales',
    description: 'Total number of VidPOD units sold across all projects.',
    why: 'Tracks VidPOD product adoption and sales volume.',
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
  const [expandedStuck, setExpandedStuck] = useState(false);

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

  // Build shared PeriodParams for the metrics library
  const periodParams: PeriodParams = useMemo(() => ({
    periodType,
    selectedYear,
    selectedMonth,
    selectedQuarter,
  }), [periodType, selectedYear, selectedMonth, selectedQuarter]);

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
  const dateRange = useMemo(() => getDateRangeFromLib(periodParams), [periodParams]);
  const invoicedStatus = useMemo(() => statuses.find(s => s.name === 'Invoiced'), [statuses]);
  const cancelledStatus = useMemo(() => statuses.find(s => s.name === 'Cancelled'), [statuses]);
  const excludedStatusIds: ExcludedStatusIds = useMemo(() => ({
    invoicedStatusId: invoicedStatus?.id,
    cancelledStatusId: cancelledStatus?.id,
  }), [invoicedStatus, cancelledStatus]);

  // Get invoiced projects in period - use invoiced_date field for accuracy
  const invoicedInPeriod = useMemo(
    () => filterProjectsByInvoicedDate(projects, dateRange),
    [projects, dateRange],
  );

  // Revenue invoiced in period
  const invoicedRevenue = useMemo(() => sumRevenue(invoicedInPeriod), [invoicedInPeriod]);

  // Projects created (POs received) in period - uses created_date (user-editable PO date), not created_at (system timestamp)
  const projectsCreatedInPeriod = useMemo(
    () => filterProjectsByCreatedDate(projects, dateRange),
    [projects, dateRange],
  );

  // Revenue from POs received in period
  const posReceivedRevenue = useMemo(() => sumRevenue(projectsCreatedInPeriod), [projectsCreatedInPeriod]);

  // Get goal for period - memoized (now includes invoiced_revenue_goal)
  const periodGoal = useMemo(
    () => computeGoalsForPeriod(goals, periodParams),
    [goals, periodParams],
  );
  const posReceivedProgress = periodGoal.revenue > 0 ? Math.min((posReceivedRevenue / periodGoal.revenue) * 100, 100) : 0;
  const invoicedRevenueProgress = periodGoal.invoicedRevenue > 0 ? Math.min((invoicedRevenue / periodGoal.invoicedRevenue) * 100, 100) : 0;

  // Overall stats - memoized calculations (only active projects)
  const projectsInProgress = useMemo(
    () => filterActiveProjects(projects, excludedStatusIds),
    [projects, excludedStatusIds],
  );

  const pipelineRevenue = useMemo(() => sumRevenue(projectsInProgress), [projectsInProgress]);


  // Average days to invoice - memoized (uses created_date as PO received date)
  const avgDaysToInvoice = useMemo(
    () => computeAvgDaysToInvoice(projects, statusHistory),
    [projects, statusHistory],
  );

  // Previous period calculations for comparison
  const previousPeriodData = useMemo(() => {
    const prevRange = getPreviousPeriodFromLib(periodParams);

    const prevPosProjects = filterProjectsByCreatedDate(projects, prevRange);
    const prevPosReceived = sumRevenue(prevPosProjects);

    const prevInvoicedProjects = filterProjectsByInvoicedDate(projects, prevRange);
    const prevInvoicedRevenue = sumRevenue(prevInvoicedProjects);

    return {
      posReceived: prevPosReceived,
      invoiced: prevInvoicedRevenue,
      projectsCompleted: prevInvoicedProjects.length,
    };
  }, [periodParams, projects]);

  // Projects completed count (invoiced this period)
  const projectsCompletedCount = invoicedInPeriod.length;
  const projectsCompletedPrevCount = previousPeriodData.projectsCompleted;


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

  // 2. Total VidPODs Sold
  const totalVidpodsSold = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.number_of_vidpods || 0), 0);
  }, [projects]);

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

  // Helper to build URL for projects page with current period filter
  const getPosReceivedUrl = () => {
    const params = new URLSearchParams();
    params.set('view', 'all'); // Show all projects including invoiced
    params.set('date_type', 'created');

    if (periodType === 'month') {
      // Map month to quarter preset + year
      const quarter = Math.ceil(selectedMonth / 3);
      params.set('date_presets', `q${quarter}`);
      params.set('date_years', String(selectedYear));
      // For specific month filtering, we'd need to add month support to projects page
      // For now, link to the quarter
    } else if (periodType === 'quarter') {
      params.set('date_presets', `q${selectedQuarter}`);
      params.set('date_years', String(selectedYear));
    } else if (periodType === 'ytd') {
      params.set('date_presets', 'this_year');
      params.set('date_years', String(selectedYear));
    } else {
      // last12 - use last_3_months as approximation (projects page doesn't have last_12_months)
      params.set('date_presets', 'last_3_months');
    }

    return `/projects?${params.toString()}`;
  };

  const getInvoicedUrl = () => {
    // For invoiced, link to archived view (invoiced projects)
    // The date filter on archived will show projects with goal_completion_date in range
    // Note: This isn't perfect since invoice date != goal date, but it's a reasonable approximation
    const params = new URLSearchParams();
    params.set('view', 'archived');

    return `/projects?${params.toString()}`;
  };

  return (
    <div className="space-y-3">
      {/* HERO: Monthly Summary - Most Prominent Metrics */}
      <div className="bg-gradient-to-r from-[#023A2D] to-[#034d3c] rounded-lg p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="grid grid-cols-2 gap-6 sm:gap-10 flex-1">
            {/* Monthly POs Received */}
            <Link href={getPosReceivedUrl()} className="block hover:opacity-90 transition-opacity">
              <MetricTooltip metric="posReceived">
                <div className="cursor-pointer">
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
            </Link>

            {/* Monthly Invoiced */}
            <Link href={getInvoicedUrl()} className="block hover:opacity-90 transition-opacity">
              <MetricTooltip metric="invoiced">
                <div className="cursor-pointer">
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
            </Link>
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
          <MetricTooltip metric="vidpodSales">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase">VidPOD Sales</span>
                <Tv className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{totalVidpodsSold}</p>
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

      {/* ROW 2: Stuck + Bottlenecks + My Tasks */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* WIP Aging - Stuck Projects */}
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
                {(expandedStuck ? wipAgingData.stuckProjects : wipAgingData.stuckProjects.slice(0, 5)).map(p => (
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
                {wipAgingData.totalStuck > 5 && (
                  <button
                    onClick={() => setExpandedStuck(!expandedStuck)}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    {expandedStuck ? 'Show less' : `+${wipAgingData.totalStuck - 5} more (${formatCurrency(wipAgingData.totalStuckRevenue)})`}
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottleneck Summary */}
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

        {/* My Tasks */}
        <MyTasksCard />
      </div>
    </div>
  );
}

// ============================================
// My Tasks Dashboard Card
// ============================================

function MyTasksCard() {
  const { user } = useUser();
  const { data: allTodos, isLoading } = useMyTodos(user?.id ?? null);
  const toggleTodo = useToggleTodo();

  const handleToggle = async (id: string) => {
    try {
      await toggleTodo.mutateAsync(id);
    } catch {
      // silent
    }
  };

  const myActive = allTodos?.filter((t) => t.owner_id === user?.id && !t.is_done) || [];
  const teamActive = allTodos?.filter((t) => t.owner_id !== user?.id && !t.is_done) || [];
  const overdue = myActive.filter((t) => t.due_date && new Date(t.due_date + 'T00:00:00') < new Date());

  return (
    <Card className={overdue.length > 0 ? 'border-l-4 border-l-destructive' : ''}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            My Tasks
          </span>
          <div className="flex items-center gap-1.5">
            {overdue.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {overdue.length} overdue
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {myActive.length} pending
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {isLoading ? (
          <div className="h-20 animate-pulse rounded-md bg-muted" />
        ) : myActive.length === 0 && teamActive.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No pending tasks</p>
        ) : (
          <div className="space-y-1.5">
            {myActive.slice(0, 5).map((todo) => (
              <DashboardTodoRow key={todo.id} todo={todo} onToggle={handleToggle} />
            ))}
            {myActive.length > 5 && (
              <p className="text-[10px] text-muted-foreground">+{myActive.length - 5} more</p>
            )}
            {teamActive.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t">
                <p className="text-[10px] text-muted-foreground mb-1">Assigned to others ({teamActive.length})</p>
                {teamActive.slice(0, 3).map((todo) => (
                  <DashboardTodoRow key={todo.id} todo={todo} onToggle={handleToggle} emphasized />
                ))}
                {teamActive.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{teamActive.length - 3} more</p>
                )}
              </div>
            )}
            <Link href="/l10/todos" className="block text-[10px] text-primary hover:underline pt-1">
              View all tasks →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardTodoRow({
  todo,
  onToggle,
  emphasized,
}: {
  todo: MyTodoWithTeam;
  onToggle: (id: string) => void;
  emphasized?: boolean;
}) {
  const isOverdue = todo.due_date && !todo.is_done && new Date(todo.due_date + 'T00:00:00') < new Date();
  const sourceMeta = todo.source_issue?.source_meta as Record<string, string> | null;

  return (
    <div className={`flex items-center gap-2 rounded p-1 -mx-1 hover:bg-muted/50 ${emphasized ? 'border-l-2 border-l-primary pl-2' : ''}`}>
      <Checkbox
        checked={todo.is_done}
        onCheckedChange={() => onToggle(todo.id)}
        className="h-3.5 w-3.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{todo.title}</p>
        <div className="flex items-center gap-1.5">
          {sourceMeta?.clientName && sourceMeta?.salesOrder ? (
            <Link
              href={`/projects/${sourceMeta.salesOrder}`}
              className="text-[10px] text-primary hover:underline"
            >
              {sourceMeta.clientName}
            </Link>
          ) : todo.source_issue ? (
            <span className="text-[10px] text-muted-foreground truncate">↳ {todo.source_issue.title}</span>
          ) : null}
          {sourceMeta?.salesOrderUrl && (
            <a
              href={sourceMeta.salesOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              {sourceMeta.salesOrder || 'Odoo'}
            </a>
          )}
        </div>
      </div>
      {todo.profiles?.full_name && emphasized && (
        <span className="text-[10px] text-muted-foreground shrink-0">{todo.profiles.full_name.split(' ')[0]}</span>
      )}
      {todo.due_date && (
        <span className={`text-[10px] shrink-0 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {new Date(todo.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  );
}
