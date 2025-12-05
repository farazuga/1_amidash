import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FolderKanban, AlertTriangle, TrendingUp } from 'lucide-react';
import { LazyStatusChart, LazyRevenueChart } from '@/components/dashboard/lazy-charts';
import { OverdueProjects } from '@/components/dashboard/overdue-projects';

// Revalidate dashboard data every 60 seconds
export const revalidate = 60;

async function getDashboardStats() {
  const supabase = await createClient();

  // Get all projects with status
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*)
    `);

  // Get all statuses
  const { data: statuses } = await supabase
    .from('statuses')
    .select('*')
    .order('display_order');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalProjects = projects?.length || 0;
  const totalRevenue = projects?.reduce((sum, p) => sum + (p.sales_amount || 0), 0) || 0;

  // Overdue projects (past goal completion date, not invoiced)
  const invoicedStatus = statuses?.find(s => s.name === 'Invoiced');
  const overdueProjects = (projects?.filter(p => {
    if (!p.goal_completion_date) return false;
    if (p.current_status_id === invoicedStatus?.id) return false;
    return new Date(p.goal_completion_date) < today;
  }) || []) as Array<{
    id: string;
    client_name: string;
    goal_completion_date: string;
    sales_amount: number | null;
    current_status: { name: string } | null;
  }>;

  // Projects by status
  const projectsByStatus = statuses?.map(status => ({
    name: status.name,
    count: projects?.filter(p => p.current_status_id === status.id).length || 0,
    color: `hsl(${status.display_order * 40}, 70%, 50%)`,
  })) || [];

  // Revenue by month (next 6 months based on goal completion date)
  const revenueByMonth: { month: string; revenue: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' });

    const monthRevenue = projects?.filter(p => {
      if (!p.goal_completion_date) return false;
      const goalDate = new Date(p.goal_completion_date);
      return goalDate.getMonth() === date.getMonth() &&
             goalDate.getFullYear() === date.getFullYear();
    }).reduce((sum, p) => sum + (p.sales_amount || 0), 0) || 0;

    revenueByMonth.push({ month: monthStr, revenue: monthRevenue });
  }

  return {
    totalProjects,
    totalRevenue,
    overdueCount: overdueProjects.length,
    overdueProjects,
    projectsByStatus,
    revenueByMonth,
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your projects and revenue
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Projects</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.overdueCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Project Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalProjects > 0
                ? Math.round(stats.totalRevenue / stats.totalProjects).toLocaleString()
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
            <CardDescription>Distribution of projects across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <LazyStatusChart data={stats.projectsByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Pipeline</CardTitle>
            <CardDescription>Expected revenue by month (based on goal dates)</CardDescription>
          </CardHeader>
          <CardContent>
            <LazyRevenueChart data={stats.revenueByMonth} />
          </CardContent>
        </Card>
      </div>

      {/* Overdue Projects */}
      {stats.overdueCount > 0 && (
        <OverdueProjects projects={stats.overdueProjects} />
      )}
    </div>
  );
}
