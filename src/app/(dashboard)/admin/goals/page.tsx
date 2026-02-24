'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { RevenueGoal } from '@/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface GoalFormData {
  [key: string]: { revenue: string; invoicedRevenue: string };
}

interface MonthlyData {
  [month: number]: number;
}

// --- Utility functions ---

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString();
}

function formatCompactCurrency(value: number): string {
  if (value === 0) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = value / 1_000_000;
    return '$' + (Number.isInteger(m) ? m : m.toFixed(1)) + 'M';
  }
  if (abs >= 1_000) {
    const k = value / 1_000;
    return '$' + (Number.isInteger(k) ? k : k.toFixed(1)) + 'K';
  }
  return '$' + value.toLocaleString();
}

function formatVariance(actual: number, goal: number): string {
  if (goal === 0) return '—';
  const diff = actual - goal;
  const prefix = diff >= 0 ? '+' : '';
  return prefix + formatCompactCurrency(diff);
}

function getVarianceColor(actual: number, goal: number): string {
  if (goal === 0) return 'text-muted-foreground';
  return actual >= goal ? 'text-green-600' : 'text-red-600';
}


function getForecastHealthColor(forecast: number, goal: number): string {
  if (goal === 0) return 'bg-muted';
  const pct = (forecast / goal) * 100;
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

function getForecastHealthTextColor(forecast: number, goal: number): string {
  if (goal === 0) return 'text-muted-foreground';
  const pct = (forecast / goal) * 100;
  if (pct >= 100) return 'text-green-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function getPercentage(actual: number, goal: number): number {
  if (goal === 0) return 0;
  return Math.round((actual / goal) * 100);
}

// --- Progress bar component ---
function HealthBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max === 0 ? 0 : Math.min((value / max) * 100, 100);
  const barColor = getForecastHealthColor(value, max);
  return (
    <div className={`h-2 w-full rounded-full bg-muted overflow-hidden ${className || ''}`}>
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// --- Inline editable cell ---
function EditableCell({
  value,
  onChange,
  isEditing,
  onStartEdit,
  onStopEdit,
  changed,
}: {
  value: string;
  onChange: (v: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  changed: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min="0"
        step="1000"
        className="h-7 w-28 text-sm text-right"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onStopEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onStopEdit();
          if (e.key === 'Escape') onStopEdit();
        }}
      />
    );
  }

  const numVal = parseFloat(value || '0') || 0;
  return (
    <button
      type="button"
      onClick={onStartEdit}
      className={`text-right text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted/80 transition-colors w-full block ${
        changed ? 'bg-amber-50 ring-1 ring-amber-300' : ''
      }`}
    >
      {numVal > 0 ? formatCurrency(numVal) : <span className="text-muted-foreground">$0</span>}
    </button>
  );
}

export default function RevenueGoalsPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [goals, setGoals] = useState<RevenueGoal[]>([]);
  const [formData, setFormData] = useState<GoalFormData>({});
  const [savedData, setSavedData] = useState<GoalFormData>({});
  const [invoicedRevenue, setInvoicedRevenue] = useState<MonthlyData>({});
  const [projectedRevenue, setProjectedRevenue] = useState<MonthlyData>({});
  const [actualPOs, setActualPOs] = useState<MonthlyData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editingCell, setEditingCell] = useState<{ month: number; field: 'revenue' | 'invoicedRevenue' } | null>(null);
  const supabase = createClient();

  const availableYears = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i));
  const isCurrentYear = parseInt(selectedYear) === currentYear;

  useEffect(() => {
    loadGoals();
    loadInvoicedRevenue();
    loadProjectedRevenue();
    loadActualPOs();
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

    const newFormData: GoalFormData = {};
    for (let month = 1; month <= 12; month++) {
      const goal = (data || []).find((g: RevenueGoal) => g.month === month);
      newFormData[month] = {
        revenue: goal?.revenue_goal?.toString() || '',
        invoicedRevenue: goal?.invoiced_revenue_goal?.toString() || '',
      };
    }
    setFormData(newFormData);
    setSavedData(JSON.parse(JSON.stringify(newFormData)));
    setIsLoading(false);
  };

  const loadInvoicedRevenue = async () => {
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, sales_amount, invoiced_date')
      .not('invoiced_date', 'is', null)
      .gte('invoiced_date', startDate)
      .lte('invoiced_date', endDate);

    const monthlyRevenue: MonthlyData = {};
    if (projectsData) {
      for (const project of projectsData) {
        if (!project.invoiced_date) continue;
        const date = new Date(project.invoiced_date + 'T00:00:00');
        const month = date.getMonth() + 1;
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (project.sales_amount || 0);
      }
    }
    setInvoicedRevenue(monthlyRevenue);
  };

  const loadProjectedRevenue = async () => {
    const { data: statusData } = await supabase
      .from('statuses')
      .select('id')
      .eq('name', 'Invoiced')
      .single();

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    let query = supabase
      .from('projects')
      .select('id, sales_amount, goal_completion_date')
      .gte('goal_completion_date', startDate)
      .lte('goal_completion_date', endDate);

    if (statusData) {
      query = query.neq('current_status_id', statusData.id);
    }

    const { data: projectsData } = await query;
    const monthlyProjected: MonthlyData = {};
    if (projectsData) {
      for (const project of projectsData) {
        if (!project.goal_completion_date) continue;
        const date = new Date(project.goal_completion_date + 'T00:00:00');
        const month = date.getMonth() + 1;
        monthlyProjected[month] = (monthlyProjected[month] || 0) + (project.sales_amount || 0);
      }
    }
    setProjectedRevenue(monthlyProjected);
  };

  const loadActualPOs = async () => {
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, sales_amount, created_date')
      .gte('created_date', startDate)
      .lte('created_date', endDate);

    const monthlyPOs: MonthlyData = {};
    if (projectsData) {
      for (const project of projectsData) {
        if (!project.created_date) continue;
        const date = new Date(project.created_date + 'T00:00:00');
        const month = date.getMonth() + 1;
        monthlyPOs[month] = (monthlyPOs[month] || 0) + (project.sales_amount || 0);
      }
    }
    setActualPOs(monthlyPOs);
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

  const handleSaveAll = () => {
    startTransition(async () => {
      const year = parseInt(selectedYear);
      let hasError = false;

      for (let month = 1; month <= 12; month++) {
        const data = formData[month];
        const revenueGoal = parseFloat(data?.revenue || '0') || 0;
        const invoicedRevenueGoal = parseFloat(data?.invoicedRevenue || '0') || 0;

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

  const isCellChanged = (month: number, field: 'revenue' | 'invoicedRevenue'): boolean => {
    return (formData[month]?.[field] || '') !== (savedData[month]?.[field] || '');
  };

  // --- Aggregation helpers ---

  const getMonthGoal = (month: number, field: 'revenue' | 'invoicedRevenue'): number => {
    return parseFloat(formData[month]?.[field] || '0') || 0;
  };

  const getQuarterlyTotal = (quarter: number) => {
    const startMonth = (quarter - 1) * 3 + 1;
    let poGoal = 0, actualPOsTotal = 0, invGoal = 0, actualInv = 0, projected = 0;
    for (let i = 0; i < 3; i++) {
      const m = startMonth + i;
      poGoal += getMonthGoal(m, 'revenue');
      actualPOsTotal += actualPOs[m] || 0;
      invGoal += getMonthGoal(m, 'invoicedRevenue');
      actualInv += invoicedRevenue[m] || 0;
      projected += projectedRevenue[m] || 0;
    }
    return { poGoal, actualPOs: actualPOsTotal, invGoal, actualInv, projected, forecast: actualInv + projected };
  };

  const getYearlyTotal = () => {
    let poGoal = 0, actualPOsTotal = 0, invGoal = 0, actualInv = 0, projected = 0;
    for (let month = 1; month <= 12; month++) {
      poGoal += getMonthGoal(month, 'revenue');
      actualPOsTotal += actualPOs[month] || 0;
      invGoal += getMonthGoal(month, 'invoicedRevenue');
      actualInv += invoicedRevenue[month] || 0;
      projected += projectedRevenue[month] || 0;
    }
    return { poGoal, actualPOs: actualPOsTotal, invGoal, actualInv, projected, forecast: actualInv + projected };
  };

  const getYTDGoal = (field: 'revenue' | 'invoicedRevenue'): number => {
    const endMonth = isCurrentYear ? currentMonth : 12;
    let total = 0;
    for (let m = 1; m <= endMonth; m++) {
      total += getMonthGoal(m, field);
    }
    return total;
  };

  const getYTDActual = (data: MonthlyData): number => {
    const endMonth = isCurrentYear ? currentMonth : 12;
    let total = 0;
    for (let m = 1; m <= endMonth; m++) {
      total += data[m] || 0;
    }
    return total;
  };

  const getRemainingProjected = (): number => {
    if (!isCurrentYear) return 0;
    let total = 0;
    for (let m = currentMonth + 1; m <= 12; m++) {
      total += projectedRevenue[m] || 0;
    }
    return total;
  };

  const getFullYearForecastInv = (): number => {
    const ytdActualInv = getYTDActual(invoicedRevenue);
    let remainingProjected = 0;
    const startMonth = isCurrentYear ? currentMonth + 1 : 1;
    for (let m = startMonth; m <= 12; m++) {
      remainingProjected += projectedRevenue[m] || 0;
    }
    return ytdActualInv + remainingProjected;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const yearly = getYearlyTotal();
  const ytdPOGoal = getYTDGoal('revenue');
  const ytdActualPOs = getYTDActual(actualPOs);
  const ytdInvGoal = getYTDGoal('invoicedRevenue');
  const ytdActualInv = getYTDActual(invoicedRevenue);
  const poPace = ytdActualPOs - ytdPOGoal;
  const invPace = ytdActualInv - ytdInvGoal;
  const fullYearForecastInv = getFullYearForecastInv();
  const remainingProjected = getRemainingProjected();
  const completedMonths = isCurrentYear ? currentMonth : 12;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Revenue Goals</h1>
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
            {/* Section A: Yearly Summary with YTD Context */}
            <Card className="border-[#023A2D]/20">
              <CardContent className="py-4 space-y-3">
                {/* PO Performance Row */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    PO Performance
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <div className="text-xs text-muted-foreground">PO Goal (Full Year)</div>
                      <div className="text-lg font-bold">{formatCurrency(yearly.poGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">YTD Goal ({MONTHS_SHORT[0]}-{MONTHS_SHORT[completedMonths - 1]})</div>
                      <div className="text-base font-semibold">{formatCurrency(ytdPOGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual POs</div>
                      <div className="text-base font-semibold">{formatCurrency(ytdActualPOs)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Variance</div>
                      <div className={`text-base font-semibold ${getVarianceColor(ytdActualPOs, ytdPOGoal)}`}>
                        {formatVariance(ytdActualPOs, ytdPOGoal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {getPercentage(ytdActualPOs, ytdPOGoal)}% of YTD goal
                      </div>
                      <HealthBar value={ytdActualPOs} max={ytdPOGoal} />
                    </div>
                  </div>
                  <div className={`text-xs ${poPace >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Pace: {formatCompactCurrency(Math.abs(poPace))} {poPace >= 0 ? 'ahead' : 'behind'} where you should be
                  </div>
                </div>

                <div className="border-t" />

                {/* Invoice Performance Row */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Invoice Performance
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <div className="text-xs text-muted-foreground">Inv Goal (Full Year)</div>
                      <div className="text-lg font-bold">{formatCurrency(yearly.invGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">YTD Goal ({MONTHS_SHORT[0]}-{MONTHS_SHORT[completedMonths - 1]})</div>
                      <div className="text-base font-semibold">{formatCurrency(ytdInvGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual Invoiced</div>
                      <div className="text-base font-semibold">{formatCurrency(ytdActualInv)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Variance</div>
                      <div className={`text-base font-semibold ${getVarianceColor(ytdActualInv, ytdInvGoal)}`}>
                        {formatVariance(ytdActualInv, ytdInvGoal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {getPercentage(ytdActualInv, ytdInvGoal)}% of YTD goal
                      </div>
                      <HealthBar value={ytdActualInv} max={ytdInvGoal} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <span className={invPace >= 0 ? 'text-green-600' : 'text-red-600'}>
                      Pace: {formatCompactCurrency(Math.abs(invPace))} {invPace >= 0 ? 'ahead' : 'behind'} where you should be
                    </span>
                    {isCurrentYear && (
                      <>
                        <span className="text-muted-foreground">
                          Projected (remaining): {formatCompactCurrency(remainingProjected)}
                        </span>
                        <span className={getForecastHealthTextColor(fullYearForecastInv, yearly.invGoal)}>
                          Forecast: {formatCompactCurrency(fullYearForecastInv)} ({getPercentage(fullYearForecastInv, yearly.invGoal)}% of goal)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t" />

                {/* Year progress */}
                <div className="text-xs text-muted-foreground">
                  {completedMonths} of 12 months complete ({Math.round((completedMonths / 12) * 100)}%)
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#023A2D] transition-all"
                      style={{ width: `${(completedMonths / 12) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section B: Quarterly Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(q => {
                const qt = getQuarterlyTotal(q);
                return (
                  <Card key={q} className="border">
                    <CardContent className="py-3 px-3 space-y-2">
                      <div className="text-sm font-semibold">Q{q}</div>

                      {/* PO section */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">PO Goal</span>
                          <span className="font-medium">{formatCompactCurrency(qt.poGoal)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Actual POs</span>
                          <span className="font-medium">{formatCompactCurrency(qt.actualPOs)}</span>
                        </div>
                        {qt.poGoal > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <HealthBar value={qt.actualPOs} max={qt.poGoal} className="flex-1 mr-2" />
                            <span className={`font-medium ${getVarianceColor(qt.actualPOs, qt.poGoal)}`}>
                              {formatVariance(qt.actualPOs, qt.poGoal)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="border-t" />

                      {/* Invoice section */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Inv Goal</span>
                          <span className="font-medium">{formatCompactCurrency(qt.invGoal)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Actual Inv</span>
                          <span className="font-medium">{formatCompactCurrency(qt.actualInv)}</span>
                        </div>
                        {qt.invGoal > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <HealthBar value={qt.actualInv} max={qt.invGoal} className="flex-1 mr-2" />
                            <span className={`font-medium ${getVarianceColor(qt.actualInv, qt.invGoal)}`}>
                              {formatVariance(qt.actualInv, qt.invGoal)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="border-t" />

                      {/* Forecast section */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-blue-600">Projected</span>
                          <span className="font-medium text-blue-600">{formatCompactCurrency(qt.projected)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Forecast</span>
                          <span className={`font-bold ${getForecastHealthTextColor(qt.forecast, qt.invGoal)}`}>
                            {formatCompactCurrency(qt.forecast)}
                          </span>
                        </div>
                        {qt.invGoal > 0 && (
                          <HealthBar value={qt.forecast} max={qt.invGoal} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Section C: Monthly Detail Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Month</TableHead>
                      <TableHead className="text-right">PO Goal</TableHead>
                      <TableHead className="text-right">Actual POs</TableHead>
                      <TableHead className="text-right">PO Var</TableHead>
                      <TableHead className="text-right">Inv Goal</TableHead>
                      <TableHead className="text-right">Actual Inv</TableHead>
                      <TableHead className="text-right">Inv Var</TableHead>
                      <TableHead className="text-right">Projected</TableHead>
                      <TableHead className="text-right">Forecast</TableHead>
                      <TableHead className="w-24 text-right">Health</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                      const poGoal = getMonthGoal(month, 'revenue');
                      const monthActualPOs = actualPOs[month] || 0;
                      const invGoal = getMonthGoal(month, 'invoicedRevenue');
                      const monthActualInv = invoicedRevenue[month] || 0;
                      const monthProjected = projectedRevenue[month] || 0;
                      const forecast = monthActualInv + monthProjected;
                      const isNow = isCurrentYear && month === currentMonth;
                      const isQuarterEnd = month % 3 === 0;
                      const isQuarterStart = month > 1 && (month - 1) % 3 === 0;

                      return (
                        <>
                          <TableRow
                            key={month}
                            className={`
                              ${isNow ? 'bg-[#023A2D]/5 font-medium' : ''}
                              ${isQuarterStart ? 'border-t-2 border-t-muted-foreground/20' : ''}
                            `}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {MONTHS[month - 1]}
                                {isNow && (
                                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-[#023A2D]">
                                    Now
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right p-1">
                              <EditableCell
                                value={formData[month]?.revenue || ''}
                                onChange={(v) => handleInputChange(month, 'revenue', v)}
                                isEditing={editingCell?.month === month && editingCell?.field === 'revenue'}
                                onStartEdit={() => setEditingCell({ month, field: 'revenue' })}
                                onStopEdit={() => setEditingCell(null)}
                                changed={isCellChanged(month, 'revenue')}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {monthActualPOs > 0 ? formatCurrency(monthActualPOs) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className={`text-right text-sm ${getVarianceColor(monthActualPOs, poGoal)}`}>
                              {poGoal > 0 ? formatVariance(monthActualPOs, poGoal) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right p-1">
                              <EditableCell
                                value={formData[month]?.invoicedRevenue || ''}
                                onChange={(v) => handleInputChange(month, 'invoicedRevenue', v)}
                                isEditing={editingCell?.month === month && editingCell?.field === 'invoicedRevenue'}
                                onStartEdit={() => setEditingCell({ month, field: 'invoicedRevenue' })}
                                onStopEdit={() => setEditingCell(null)}
                                changed={isCellChanged(month, 'invoicedRevenue')}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {monthActualInv > 0 ? formatCurrency(monthActualInv) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className={`text-right text-sm ${getVarianceColor(monthActualInv, invGoal)}`}>
                              {invGoal > 0 ? formatVariance(monthActualInv, invGoal) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right text-sm text-blue-600">
                              {monthProjected > 0 ? formatCurrency(monthProjected) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className={`text-right text-sm font-medium ${getForecastHealthTextColor(forecast, invGoal)}`}>
                              {forecast > 0 ? formatCurrency(forecast) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {invGoal > 0 ? (
                                <div className="flex items-center gap-2 justify-end">
                                  <HealthBar value={forecast} max={invGoal} className="w-16" />
                                  <span className={`text-xs ${getForecastHealthTextColor(forecast, invGoal)}`}>
                                    {getPercentage(forecast, invGoal)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Quarterly subtotal row */}
                          {isQuarterEnd && (() => {
                            const q = month / 3;
                            const qt = getQuarterlyTotal(q);
                            return (
                              <TableRow key={`q${q}`} className="bg-muted/40 text-xs font-semibold">
                                <TableCell>Q{q} Subtotal</TableCell>
                                <TableCell className="text-right">{formatCurrency(qt.poGoal)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(qt.actualPOs)}</TableCell>
                                <TableCell className={`text-right ${getVarianceColor(qt.actualPOs, qt.poGoal)}`}>
                                  {qt.poGoal > 0 ? formatVariance(qt.actualPOs, qt.poGoal) : '—'}
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(qt.invGoal)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(qt.actualInv)}</TableCell>
                                <TableCell className={`text-right ${getVarianceColor(qt.actualInv, qt.invGoal)}`}>
                                  {qt.invGoal > 0 ? formatVariance(qt.actualInv, qt.invGoal) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-blue-600">{formatCurrency(qt.projected)}</TableCell>
                                <TableCell className={`text-right font-bold ${getForecastHealthTextColor(qt.forecast, qt.invGoal)}`}>
                                  {formatCurrency(qt.forecast)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {qt.invGoal > 0 ? (
                                    <div className="flex items-center gap-2 justify-end">
                                      <HealthBar value={qt.forecast} max={qt.invGoal} className="w-16" />
                                      <span className={`text-xs ${getForecastHealthTextColor(qt.forecast, qt.invGoal)}`}>
                                        {getPercentage(qt.forecast, qt.invGoal)}%
                                      </span>
                                    </div>
                                  ) : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })()}
                        </>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-bold text-sm">
                      <TableCell>Year Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(yearly.poGoal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(yearly.actualPOs)}</TableCell>
                      <TableCell className={`text-right ${getVarianceColor(yearly.actualPOs, yearly.poGoal)}`}>
                        {yearly.poGoal > 0 ? formatVariance(yearly.actualPOs, yearly.poGoal) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(yearly.invGoal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(yearly.actualInv)}</TableCell>
                      <TableCell className={`text-right ${getVarianceColor(yearly.actualInv, yearly.invGoal)}`}>
                        {yearly.invGoal > 0 ? formatVariance(yearly.actualInv, yearly.invGoal) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">{formatCurrency(yearly.projected)}</TableCell>
                      <TableCell className={`text-right ${getForecastHealthTextColor(yearly.forecast, yearly.invGoal)}`}>
                        {formatCurrency(yearly.forecast)}
                      </TableCell>
                      <TableCell className="text-right">
                        {yearly.invGoal > 0 ? (
                          <div className="flex items-center gap-2 justify-end">
                            <HealthBar value={yearly.forecast} max={yearly.invGoal} className="w-16" />
                            <span className={`text-xs ${getForecastHealthTextColor(yearly.forecast, yearly.invGoal)}`}>
                              {getPercentage(yearly.forecast, yearly.invGoal)}%
                            </span>
                          </div>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
