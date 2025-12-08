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
} from 'lucide-react';
import { LazyRevenueChart } from '@/components/dashboard/lazy-charts';
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
  const { projects, statuses, statusHistory, goals } = initialData;

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
                <span className="font-medium">{posReceivedProgress.toFixed(1)}%</span>
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
                <span className="font-medium">{invoicedRevenueProgress.toFixed(1)}%</span>
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

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
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
