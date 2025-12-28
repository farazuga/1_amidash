'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, DollarSign, Target, Save, Copy, Receipt, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import type { RevenueGoal } from '@/types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

interface GoalFormData {
  [key: string]: { revenue: string; invoicedRevenue: string };
}

interface InvoicedRevenueData {
  [month: number]: number;
}

interface ProjectedRevenueData {
  [month: number]: number;
}

export default function RevenueGoalsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [goals, setGoals] = useState<RevenueGoal[]>([]);
  const [formData, setFormData] = useState<GoalFormData>({});
  const [invoicedRevenue, setInvoicedRevenue] = useState<InvoicedRevenueData>({});
  const [projectedRevenue, setProjectedRevenue] = useState<ProjectedRevenueData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // Generate available years (current year - 1 to current year + 2)
  const availableYears = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i));

  useEffect(() => {
    loadGoals();
    loadInvoicedRevenue();
    loadProjectedRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const loadGoals = async () => {
    setIsLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('revenue_goals')
      .select('*')
      .eq('year', parseInt(selectedYear))
      .order('month');

    if (error) {
      console.error('Error loading goals:', error);
      toast.error('Failed to load revenue goals');
      setIsLoading(false);
      return;
    }

    setGoals((data || []) as RevenueGoal[]);

    // Initialize form data
    const newFormData: GoalFormData = {};
    for (let month = 1; month <= 12; month++) {
      const goal = (data || []).find((g: RevenueGoal) => g.month === month);
      newFormData[month] = {
        revenue: goal?.revenue_goal?.toString() || '',
        invoicedRevenue: goal?.invoiced_revenue_goal?.toString() || '',
      };
    }
    setFormData(newFormData);
    setIsLoading(false);
  };

  const loadInvoicedRevenue = async () => {
    // Get the "Invoiced" status ID
    const { data: statusData } = await supabase
      .from('statuses')
      .select('id')
      .eq('name', 'Invoiced')
      .single();

    if (!statusData) return;

    const invoicedStatusId = statusData.id;

    // Get all status history entries where status was changed to "Invoiced" in the selected year
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data: historyData } = await supabase
      .from('status_history')
      .select(`
        project_id,
        changed_at,
        projects!inner(sales_amount)
      `)
      .eq('status_id', invoicedStatusId)
      .gte('changed_at', startDate)
      .lte('changed_at', endDate);

    // Group by month and calculate total revenue
    const monthlyRevenue: InvoicedRevenueData = {};

    if (historyData) {
      // Track which projects we've already counted per month to avoid duplicates
      const countedProjects: { [key: string]: Set<string> } = {};

      for (const entry of historyData) {
        if (!entry.changed_at || !entry.project_id) continue;
        const date = new Date(entry.changed_at);
        const month = date.getMonth() + 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salesAmount = (entry.projects as any)?.sales_amount || 0;
        const projectId = entry.project_id;

        if (!countedProjects[month]) {
          countedProjects[month] = new Set();
        }

        // Only count each project once per month (first time it was marked as invoiced)
        if (!countedProjects[month].has(projectId)) {
          countedProjects[month].add(projectId);
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + salesAmount;
        }
      }
    }

    setInvoicedRevenue(monthlyRevenue);
  };

  const loadProjectedRevenue = async () => {
    // Get all projects with goal_completion_date in the selected year
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, sales_amount, goal_completion_date')
      .gte('goal_completion_date', startDate)
      .lte('goal_completion_date', endDate);

    // Group by month and calculate total projected revenue
    const monthlyProjected: ProjectedRevenueData = {};

    if (projectsData) {
      for (const project of projectsData) {
        if (!project.goal_completion_date) continue;
        const date = new Date(project.goal_completion_date);
        const month = date.getMonth() + 1;
        const salesAmount = project.sales_amount || 0;
        monthlyProjected[month] = (monthlyProjected[month] || 0) + salesAmount;
      }
    }

    setProjectedRevenue(monthlyProjected);
  };

  const handleInputChange = (month: number, field: 'revenue' | 'invoicedRevenue', value: string) => {
    setFormData(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value,
      },
    }));
  };

  const copyInvoicedToGoal = (month: number) => {
    const revenue = invoicedRevenue[month] || 0;
    setFormData(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        invoicedRevenue: revenue.toString(),
      },
    }));
    toast.success(`Copied $${revenue.toLocaleString()} to invoiced revenue goal`);
  };

  const handleSaveAll = () => {
    startTransition(async () => {
      const year = parseInt(selectedYear);
      let hasError = false;

      for (let month = 1; month <= 12; month++) {
        const data = formData[month];
        const revenueGoal = parseFloat(data?.revenue || '0') || 0;
        const invoicedRevenueGoal = parseFloat(data?.invoicedRevenue || '0') || 0;

        // Skip if both are 0 and no existing goal
        const existingGoal = goals.find(g => g.month === month);
        if (!existingGoal && revenueGoal === 0 && invoicedRevenueGoal === 0) {
          continue;
        }

        if (existingGoal) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)('revenue_goals')
            .update({
              revenue_goal: revenueGoal,
              invoiced_revenue_goal: invoicedRevenueGoal,
            })
            .eq('id', existingGoal.id);

          if (error) {
            console.error('Error updating goal:', error);
            hasError = true;
          }
        } else if (revenueGoal > 0 || invoicedRevenueGoal > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)('revenue_goals')
            .insert({
              year,
              month,
              revenue_goal: revenueGoal,
              invoiced_revenue_goal: invoicedRevenueGoal,
            });

          if (error) {
            console.error('Error creating goal:', error);
            hasError = true;
          }
        }
      }

      if (hasError) {
        toast.error('Some goals failed to save');
      } else {
        toast.success('Revenue goals saved successfully');
      }

      loadGoals();
    });
  };

  // Calculate quarterly totals
  const getQuarterlyTotal = (quarter: number) => {
    const startMonth = (quarter - 1) * 3 + 1;
    let revenue = 0;
    let invoicedRevenueTotal = 0;
    let actualInvoiced = 0;
    let projected = 0;
    for (let i = 0; i < 3; i++) {
      const month = startMonth + i;
      revenue += parseFloat(formData[month]?.revenue || '0') || 0;
      invoicedRevenueTotal += parseFloat(formData[month]?.invoicedRevenue || '0') || 0;
      actualInvoiced += invoicedRevenue[month] || 0;
      projected += projectedRevenue[month] || 0;
    }
    return { revenue, invoicedRevenue: invoicedRevenueTotal, actualInvoiced, projected };
  };

  // Calculate yearly total
  const getYearlyTotal = () => {
    let revenue = 0;
    let invoicedRevenueTotal = 0;
    let actualInvoiced = 0;
    let projected = 0;
    for (let month = 1; month <= 12; month++) {
      revenue += parseFloat(formData[month]?.revenue || '0') || 0;
      invoicedRevenueTotal += parseFloat(formData[month]?.invoicedRevenue || '0') || 0;
      actualInvoiced += invoicedRevenue[month] || 0;
      projected += projectedRevenue[month] || 0;
    }
    return { revenue, invoicedRevenue: invoicedRevenueTotal, actualInvoiced, projected };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const yearlyTotal = getYearlyTotal();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Goals</h1>
          <p className="text-sm text-muted-foreground">
            Set monthly revenue targets and track invoiced revenue
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={isPending} size="sm">
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All
        </Button>
      </div>

      <Tabs value={selectedYear} onValueChange={setSelectedYear}>
        <TabsList className="h-8">
          {availableYears.map(year => (
            <TabsTrigger key={year} value={year} className="text-xs px-3 py-1">
              {year}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableYears.map(year => (
          <TabsContent key={year} value={year} className="space-y-4 mt-4">
            {/* Yearly Summary - Compact */}
            <Card className="border-[#023A2D]/20">
              <CardContent className="py-3">
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <DollarSign className="h-3 w-3" />
                      Revenue Goal
                    </div>
                    <div className="text-lg font-bold text-[#023A2D]">
                      ${yearlyTotal.revenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <Receipt className="h-3 w-3" />
                      Invoiced Goal
                    </div>
                    <div className="text-lg font-bold text-[#023A2D]">
                      ${yearlyTotal.invoicedRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-1 text-xs text-green-600 mb-0.5">
                      <Target className="h-3 w-3" />
                      Actual Invoiced
                    </div>
                    <div className="text-lg font-bold text-green-700">
                      ${yearlyTotal.actualInvoiced.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-1 text-xs text-blue-600 mb-0.5">
                      <TrendingUp className="h-3 w-3" />
                      Projected
                    </div>
                    <div className="text-lg font-bold text-blue-700">
                      ${yearlyTotal.projected.toLocaleString()}
                    </div>
                  </div>
                  {QUARTERS.map((q, i) => {
                    const total = getQuarterlyTotal(i + 1);
                    return (
                      <div key={q} className="p-2 bg-muted/30 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-0.5">{q}</div>
                        <div className="text-sm font-semibold">
                          ${total.revenue.toLocaleString()}
                        </div>
                        <div className="text-xs text-green-600">
                          ${total.actualInvoiced.toLocaleString()}
                        </div>
                        <div className="text-xs text-blue-600">
                          ${total.projected.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Goals Grid - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {MONTHS.map((monthName, index) => {
                const month = index + 1;
                const isCurrentMonth = parseInt(year) === currentYear && month === new Date().getMonth() + 1;
                const actualInvoicedForMonth = invoicedRevenue[month] || 0;
                const projectedForMonth = projectedRevenue[month] || 0;

                return (
                  <Card
                    key={month}
                    className={`${isCurrentMonth ? 'border-[#023A2D] ring-1 ring-[#023A2D]/20' : ''}`}
                  >
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        {monthName}
                        {isCurrentMonth && (
                          <span className="text-[10px] bg-[#023A2D] text-white px-1.5 py-0.5 rounded">
                            Now
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3">
                      <div className="space-y-1">
                        <Label htmlFor={`revenue-${month}`} className="text-xs">
                          Revenue Goal
                        </Label>
                        <Input
                          id={`revenue-${month}`}
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="0"
                          className="h-8 text-sm"
                          value={formData[month]?.revenue || ''}
                          onChange={(e) => handleInputChange(month, 'revenue', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`invoiced-${month}`} className="text-xs">
                          Invoiced Revenue Goal
                        </Label>
                        <Input
                          id={`invoiced-${month}`}
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="0"
                          className="h-8 text-sm"
                          value={formData[month]?.invoicedRevenue || ''}
                          onChange={(e) => handleInputChange(month, 'invoicedRevenue', e.target.value)}
                        />
                      </div>
                      {/* Actual Invoiced & Projected Revenue */}
                      <div className="pt-1 border-t space-y-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-muted-foreground">Actual Invoiced</div>
                            <div className="text-sm font-semibold text-green-600">
                              ${actualInvoicedForMonth.toLocaleString()}
                            </div>
                          </div>
                          {actualInvoicedForMonth > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyInvoicedToGoal(month)}
                              title="Copy to goal"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Projected (by goal date)</div>
                          <div className="text-sm font-semibold text-blue-600">
                            ${projectedForMonth.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
