'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { LazyStatusChart, LazyRevenueChart } from '@/components/dashboard/lazy-charts';
import { OverdueProjects } from '@/components/dashboard/overdue-projects';
import { format, differenceInDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

interface Project {
  id: string;
  client_name: string;
  sales_amount: number | null;
  goal_completion_date: string | null;
  current_status_id: string | null;
  created_at: string | null;
  current_status: { id: string; name: string } | null;
}

interface Status {
  id: string;
  name: string;
  display_order: number;
}

interface StatusHistoryItem {
  id: string;
  project_id: string;
  status_id: string;
  changed_at: string;
  status: { name: string } | null;
  project?: { id: string; client_name: string; sales_amount: number | null } | null;
}

interface RevenueGoal {
  year: number;
  month: number;
  revenue_goal: number;
  projects_goal: number;
}

type PeriodType = 'month' | 'quarter' | 'year';

export function DashboardContent() {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [goals, setGoals] = useState<RevenueGoal[]>([]);

  // Memoize supabase client to prevent infinite loop
  // (createClient() on every render would break useCallback dependencies)
  const supabase = useMemo(() => createClient(), []);

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

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const [projectsRes, statusesRes, historyRes, goalsRes] = await Promise.all([
      supabase.from('projects').select(`*, current_status:statuses(*)`),
      supabase.from('statuses').select('*').order('display_order'),
      supabase.from('status_history').select(`*, status:statuses(*), project:projects(id, client_name, sales_amount)`).order('changed_at', { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any)('revenue_goals').select('*'),
    ]);

    setProjects((projectsRes.data || []) as Project[]);
    setStatuses((statusesRes.data || []) as Status[]);
    setStatusHistory((historyRes.data || []) as StatusHistoryItem[]);
    setGoals((goalsRes.data || []) as RevenueGoal[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Get goal for period - memoized
  const periodGoal = useMemo(() => {
    if (periodType === 'month') {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const goal = goals.find(g => g.year === year && g.month === month);
      return { revenue: goal?.revenue_goal || 0, projects: goal?.projects_goal || 0 };
    } else if (periodType === 'quarter') {
      const [year, q] = selectedPeriod.split('-Q');
      const startMonth = (parseInt(q) - 1) * 3 + 1;
      let revenue = 0;
      let projectsGoal = 0;
      for (let m = startMonth; m < startMonth + 3; m++) {
        const goal = goals.find(g => g.year === parseInt(year) && g.month === m);
        revenue += goal?.revenue_goal || 0;
        projectsGoal += goal?.projects_goal || 0;
      }
      return { revenue, projects: projectsGoal };
    } else {
      const year = parseInt(selectedPeriod);
      let revenue = 0;
      let projectsGoal = 0;
      for (let m = 1; m <= 12; m++) {
        const goal = goals.find(g => g.year === year && g.month === m);
        revenue += goal?.revenue_goal || 0;
        projectsGoal += goal?.projects_goal || 0;
      }
      return { revenue, projects: projectsGoal };
    }
  }, [periodType, selectedPeriod, goals]);
  const revenueProgress = periodGoal.revenue > 0 ? Math.min((invoicedRevenue / periodGoal.revenue) * 100, 100) : 0;
  const projectsProgress = periodGoal.projects > 0 ? Math.min((invoicedInPeriod.length / periodGoal.projects) * 100, 100) : 0;

  // Overall stats - memoized calculations
  const totalRevenue = useMemo(() =>
    projects.reduce((sum, p) => sum + (p.sales_amount || 0), 0),
    [projects]
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

  // Projects by status - memoized
  const projectsByStatus = useMemo(() => statuses.map(status => ({
    name: status.name,
    count: projects.filter(p => p.current_status_id === status.id).length,
    color: `hsl(${status.display_order * 40}, 70%, 50%)`,
  })), [statuses, projects]);

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

  const totalProjects = projects.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            {/* Revenue Goal Progress */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-bold text-[#023A2D]">
                  ${invoicedRevenue.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  of ${periodGoal.revenue.toLocaleString()} goal
                </span>
              </div>
              <Progress value={revenueProgress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revenue Invoiced</span>
                <span className="font-medium">{revenueProgress.toFixed(1)}%</span>
              </div>
            </div>

            {/* Projects Goal Progress */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-bold text-[#023A2D]">
                  {invoicedInPeriod.length}
                </span>
                <span className="text-sm text-muted-foreground">
                  of {periodGoal.projects} projects goal
                </span>
              </div>
              <Progress value={projectsProgress} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Projects Invoiced</span>
                <span className="font-medium">{projectsProgress.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overdueProjects.length}
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

      {/* Projects by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
          <CardDescription>Current status distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {projectsByStatus.filter(s => s.count > 0).map(status => (
              <div key={status.name} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                <span className="font-medium">{status.name}</span>
                <Badge variant="secondary">{status.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

      {/* Charts */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
            <CardDescription>Distribution of projects across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <LazyStatusChart data={projectsByStatus} />
          </CardContent>
        </Card>

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

      {/* Overdue Projects */}
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
    </div>
  );
}
