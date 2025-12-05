'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, DollarSign, Target, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { RevenueGoal } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

interface GoalFormData {
  [key: string]: { revenue: string; projects: string };
}

export default function RevenueGoalsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [goals, setGoals] = useState<RevenueGoal[]>([]);
  const [formData, setFormData] = useState<GoalFormData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // Generate available years (current year - 1 to current year + 2)
  const availableYears = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i));

  useEffect(() => {
    loadGoals();
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
        projects: goal?.projects_goal?.toString() || '',
      };
    }
    setFormData(newFormData);
    setIsLoading(false);
  };

  const handleInputChange = (month: number, field: 'revenue' | 'projects', value: string) => {
    setFormData(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value,
      },
    }));
  };

  const handleSaveAll = () => {
    startTransition(async () => {
      const year = parseInt(selectedYear);
      let hasError = false;

      for (let month = 1; month <= 12; month++) {
        const data = formData[month];
        const revenueGoal = parseFloat(data?.revenue || '0') || 0;
        const projectsGoal = parseInt(data?.projects || '0') || 0;

        // Skip if both are 0 and no existing goal
        const existingGoal = goals.find(g => g.month === month);
        if (!existingGoal && revenueGoal === 0 && projectsGoal === 0) {
          continue;
        }

        if (existingGoal) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)('revenue_goals')
            .update({
              revenue_goal: revenueGoal,
              projects_goal: projectsGoal,
            })
            .eq('id', existingGoal.id);

          if (error) {
            console.error('Error updating goal:', error);
            hasError = true;
          }
        } else if (revenueGoal > 0 || projectsGoal > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)('revenue_goals')
            .insert({
              year,
              month,
              revenue_goal: revenueGoal,
              projects_goal: projectsGoal,
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
    let projects = 0;
    for (let i = 0; i < 3; i++) {
      const month = startMonth + i;
      revenue += parseFloat(formData[month]?.revenue || '0') || 0;
      projects += parseInt(formData[month]?.projects || '0') || 0;
    }
    return { revenue, projects };
  };

  // Calculate yearly total
  const getYearlyTotal = () => {
    let revenue = 0;
    let projects = 0;
    for (let month = 1; month <= 12; month++) {
      revenue += parseFloat(formData[month]?.revenue || '0') || 0;
      projects += parseInt(formData[month]?.projects || '0') || 0;
    }
    return { revenue, projects };
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revenue Goals</h1>
          <p className="text-muted-foreground">
            Set monthly revenue and project goals for tracking
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All
        </Button>
      </div>

      <Tabs value={selectedYear} onValueChange={setSelectedYear}>
        <TabsList>
          {availableYears.map(year => (
            <TabsTrigger key={year} value={year}>
              {year}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableYears.map(year => (
          <TabsContent key={year} value={year} className="space-y-6">
            {/* Yearly Summary */}
            <Card className="border-[#023A2D]/20">
              <CardHeader>
                <CardTitle className="text-[#023A2D]">{year} Summary</CardTitle>
                <CardDescription>Total goals for the year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      Total Revenue Goal
                    </div>
                    <div className="text-2xl font-bold text-[#023A2D]">
                      ${yearlyTotal.revenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Target className="h-4 w-4" />
                      Total Projects Goal
                    </div>
                    <div className="text-2xl font-bold text-[#023A2D]">
                      {yearlyTotal.projects}
                    </div>
                  </div>
                  {QUARTERS.map((q, i) => {
                    const total = getQuarterlyTotal(i + 1);
                    return (
                      <div key={q} className="p-4 bg-muted/30 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">{q}</div>
                        <div className="text-lg font-semibold">
                          ${total.revenue.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {total.projects} projects
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Goals Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MONTHS.map((monthName, index) => {
                const month = index + 1;
                const isCurrentMonth = parseInt(year) === currentYear && month === new Date().getMonth() + 1;
                return (
                  <Card
                    key={month}
                    className={isCurrentMonth ? 'border-[#023A2D] ring-1 ring-[#023A2D]/20' : ''}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        {monthName}
                        {isCurrentMonth && (
                          <span className="text-xs bg-[#023A2D] text-white px-2 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`revenue-${month}`} className="text-sm">
                          Revenue Goal ($)
                        </Label>
                        <Input
                          id={`revenue-${month}`}
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="0"
                          value={formData[month]?.revenue || ''}
                          onChange={(e) => handleInputChange(month, 'revenue', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`projects-${month}`} className="text-sm">
                          Projects Invoiced Goal
                        </Label>
                        <Input
                          id={`projects-${month}`}
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={formData[month]?.projects || ''}
                          onChange={(e) => handleInputChange(month, 'projects', e.target.value)}
                        />
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
