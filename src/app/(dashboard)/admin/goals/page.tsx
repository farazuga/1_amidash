'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, useRef, Fragment } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ShieldAlert, ChevronRight, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import type { RevenueGoal } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

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

// --- Link helpers ---

const MONTH_PRESET_MAP = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function getProjectsLink(
  dateType: 'created' | 'invoiced' | 'goal',
  period: { month?: number; quarter?: number; year?: number },
  year: string
): string {
  const view = dateType === 'goal' ? 'active' : 'all';
  const params = new URLSearchParams();
  params.set('view', view);
  params.set('date_type', dateType);
  params.set('date_years', year);

  if (period.month) {
    params.set('date_presets', MONTH_PRESET_MAP[period.month - 1]);
  } else if (period.quarter) {
    params.set('date_presets', `q${period.quarter}`);
  }

  return `/projects?${params.toString()}`;
}

// --- Time-aware forecast health (for monthly rows) ---
// monthsAhead: 0 = current month, 1 = next, 2 = 3rd month, 3+ = far future
// Current & next month: green ≥90%, orange 80–89%, red <80%
// 3rd month: green ≥90%, orange <90%, no red
// Beyond: no color coding
function getMonthForecastBarColor(forecast: number, goal: number, monthsAhead: number): string {
  if (goal === 0) return 'bg-muted';
  if (monthsAhead >= 3) return 'bg-muted';
  const pct = (forecast / goal) * 100;
  if (pct >= 90) return 'bg-green-500';
  if (monthsAhead <= 1) return pct >= 80 ? 'bg-amber-500' : 'bg-red-500';
  // monthsAhead === 2: orange only
  return 'bg-amber-500';
}

function getMonthForecastTextColor(forecast: number, goal: number, monthsAhead: number): string {
  if (goal === 0) return 'text-muted-foreground';
  if (monthsAhead >= 3) return 'text-muted-foreground';
  const pct = (forecast / goal) * 100;
  if (pct >= 90) return 'text-green-600';
  if (monthsAhead <= 1) return pct >= 80 ? 'text-amber-600' : 'text-red-600';
  return 'text-amber-600';
}

// --- Progress bar component ---
function HealthBar({ value, max, className, colorOverride }: { value: number; max: number; className?: string; colorOverride?: string }) {
  const pct = max === 0 ? 0 : Math.min((value / max) * 100, 100);
  const barColor = colorOverride || getForecastHealthColor(value, max);
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
        changed ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-muted/20 border border-dashed border-muted-foreground/20'
      }`}
    >
      {numVal > 0 ? formatCurrency(numVal) : <span className="text-muted-foreground">$0</span>}
    </button>
  );
}

// --- Clickable value cell ---
function ClickableValue({
  value,
  href,
  className,
}: {
  value: number;
  href: string;
  className?: string;
}) {
  if (value <= 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Link
      href={href}
      className={`underline decoration-dotted underline-offset-2 hover:decoration-solid ${className || ''}`}
    >
      {formatCurrency(value)}
    </Link>
  );
}

export default function RevenueGoalsPage() {
  const { isAdmin, profile } = useUser();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
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
  const [expandedQuarters, setExpandedQuarters] = useState<Set<number>>(new Set([currentQuarter]));
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

  const hasChanges = Array.from({ length: 12 }, (_, i) => i + 1).some(
    month => isCellChanged(month, 'revenue') || isCellChanged(month, 'invoicedRevenue')
  );

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

  const toggleQuarter = (q: number) => {
    setExpandedQuarters(prev => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center">You don&apos;t have permission to view this page.</p>
        <Button asChild variant="outline">
          <Link href="/projects">Go to Projects</Link>
        </Button>
      </div>
    );
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Revenue Goals</h1>
        <Button onClick={handleSaveAll} disabled={isPending || !hasChanges} size="sm">
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
          <TabsContent key={year} value={year} className="space-y-6 mt-4">
            {/* Yearly Summary */}
            <Card className="border-[#023A2D]/20">
              <CardContent className="py-5 space-y-4">
                {/* PO Performance */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    PO Performance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <div className="text-xs text-muted-foreground">PO Goal (Full Year)</div>
                      <div className="text-xl font-extrabold">{formatCurrency(yearly.poGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">YTD Goal ({MONTHS_SHORT[0]}–{MONTHS_SHORT[completedMonths - 1]})</div>
                      <div className="text-base font-medium">{formatCurrency(ytdPOGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual POs</div>
                      <div className="text-base font-medium">{formatCurrency(ytdActualPOs)}</div>
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
                    {formatCompactCurrency(Math.abs(poPace))} {poPace >= 0 ? 'ahead of' : 'behind'} pace
                  </div>
                </div>

                <div className="border-t" />

                {/* Invoice Performance */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Invoice Performance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <div className="text-xs text-muted-foreground">Invoiced Goal (Full Year)</div>
                      <div className="text-xl font-extrabold">{formatCurrency(yearly.invGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">YTD Goal ({MONTHS_SHORT[0]}–{MONTHS_SHORT[completedMonths - 1]})</div>
                      <div className="text-base font-medium">{formatCurrency(ytdInvGoal)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Actual Invoiced</div>
                      <div className="text-base font-medium">{formatCurrency(ytdActualInv)}</div>
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
                      {formatCompactCurrency(Math.abs(invPace))} {invPace >= 0 ? 'ahead of' : 'behind'} pace
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
                  <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#023A2D] transition-all"
                      style={{ width: `${(completedMonths / 12) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Detail Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="w-32 align-bottom border-b-0">Month</TableHead>
                        <TableHead colSpan={3} className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          PO Performance
                        </TableHead>
                        <TableHead colSpan={6} className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-l border-l-muted-foreground/20">
                          Invoice Performance &amp; Forecast
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="text-right">Goal</TableHead>
                        <TableHead className="text-right">Actual POs</TableHead>
                        <TableHead className="text-right">vs Goal</TableHead>
                        <TableHead className="text-right border-l border-l-muted-foreground/20">Goal</TableHead>
                        <TableHead className="text-right">Invoiced</TableHead>
                        <TableHead className="text-right">vs Goal</TableHead>
                        <TableHead className="text-right" title="Active projects not yet invoiced">Projected</TableHead>
                        <TableHead className="text-right" title="Actual Invoiced + Projected">Forecast</TableHead>
                        <TableHead className="w-28 text-right">Health</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[1, 2, 3, 4].map(q => {
                        const isExpanded = expandedQuarters.has(q);
                        const qt = getQuarterlyTotal(q);
                        const startMonth = (q - 1) * 3 + 1;
                        // Quarter is fully future if its first month is after current month
                        const isQuarterFullyFuture = isCurrentYear && startMonth > currentMonth;
                        // For forecast health: use the nearest month in the quarter relative to now
                        const qMonthsAhead = isCurrentYear
                          ? Math.max(0, startMonth - currentMonth)
                          : -1; // past year → use default colors
                        const qForecastTextColor = qMonthsAhead >= 0
                          ? getMonthForecastTextColor(qt.forecast, qt.invGoal, qMonthsAhead)
                          : getForecastHealthTextColor(qt.forecast, qt.invGoal);
                        const qForecastBarColor = qMonthsAhead >= 0
                          ? getMonthForecastBarColor(qt.forecast, qt.invGoal, qMonthsAhead)
                          : undefined;
                        // PO/Inv variance: muted if quarter is fully in the future
                        const qPoVarColor = isQuarterFullyFuture ? 'text-muted-foreground' : getVarianceColor(qt.actualPOs, qt.poGoal);
                        const qInvVarColor = isQuarterFullyFuture ? 'text-muted-foreground' : getVarianceColor(qt.actualInv, qt.invGoal);

                        return (
                          <Fragment key={`q${q}`}>
                            {/* Quarter subtotal row — always visible */}
                            <TableRow
                              className={`bg-muted/40 text-xs font-semibold cursor-pointer hover:bg-muted/60 border-l-2 border-l-muted-foreground/30 ${q > 1 ? 'border-t-2 border-t-muted-foreground/20' : ''}`}
                              onClick={() => toggleQuarter(q)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  Q{q}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(qt.poGoal)}</TableCell>
                              <TableCell className="text-right">
                                <ClickableValue
                                  value={qt.actualPOs}
                                  href={getProjectsLink('created', { quarter: q }, selectedYear)}
                                />
                              </TableCell>
                              <TableCell className={`text-right ${qPoVarColor}`}>
                                {qt.poGoal > 0 ? formatVariance(qt.actualPOs, qt.poGoal) : '—'}
                              </TableCell>
                              <TableCell className="text-right border-l border-l-muted-foreground/20">{formatCurrency(qt.invGoal)}</TableCell>
                              <TableCell className="text-right">
                                <ClickableValue
                                  value={qt.actualInv}
                                  href={getProjectsLink('invoiced', { quarter: q }, selectedYear)}
                                />
                              </TableCell>
                              <TableCell className={`text-right ${qInvVarColor}`}>
                                {qt.invGoal > 0 ? formatVariance(qt.actualInv, qt.invGoal) : '—'}
                              </TableCell>
                              <TableCell className="text-right text-blue-600">
                                <ClickableValue
                                  value={qt.projected}
                                  href={getProjectsLink('goal', { quarter: q }, selectedYear)}
                                  className="text-blue-600"
                                />
                              </TableCell>
                              <TableCell className={`text-right font-bold ${qForecastTextColor}`}>
                                {formatCurrency(qt.forecast)}
                              </TableCell>
                              <TableCell className="text-right">
                                {qt.invGoal > 0 ? (
                                  <div className="flex items-center gap-2 justify-end">
                                    <HealthBar value={qt.forecast} max={qt.invGoal} className="w-20" colorOverride={qForecastBarColor} />
                                    <span className={`text-xs ${qForecastTextColor}`}>
                                      {getPercentage(qt.forecast, qt.invGoal)}%
                                    </span>
                                  </div>
                                ) : '—'}
                              </TableCell>
                            </TableRow>

                            {/* Month rows — only when quarter is expanded */}
                            {isExpanded && Array.from({ length: 3 }, (_, i) => startMonth + i).map(month => {
                              const poGoal = getMonthGoal(month, 'revenue');
                              const monthActualPOs = actualPOs[month] || 0;
                              const invGoal = getMonthGoal(month, 'invoicedRevenue');
                              const monthActualInv = invoicedRevenue[month] || 0;
                              const monthProjected = projectedRevenue[month] || 0;
                              const forecast = monthActualInv + monthProjected;
                              const isNow = isCurrentYear && month === currentMonth;
                              const isFutureMonth = isCurrentYear && month > currentMonth;
                              const monthsAhead = isCurrentYear ? month - currentMonth : -1; // -1 = past year, use default

                              // PO variance: no red/green for future months
                              const poVarColor = isFutureMonth ? 'text-muted-foreground' : getVarianceColor(monthActualPOs, poGoal);
                              // Invoice variance: same treatment
                              const invVarColor = isFutureMonth ? 'text-muted-foreground' : getVarianceColor(monthActualInv, invGoal);
                              // Forecast/health: time-aware for current year, default for past years
                              const forecastTextColor = monthsAhead >= 0
                                ? getMonthForecastTextColor(forecast, invGoal, monthsAhead)
                                : getForecastHealthTextColor(forecast, invGoal);
                              const forecastBarColor = monthsAhead >= 0
                                ? getMonthForecastBarColor(forecast, invGoal, monthsAhead)
                                : undefined;

                              return (
                                <TableRow
                                  key={month}
                                  className={
                                    isNow
                                      ? 'bg-[#023A2D]/8 font-medium border-l-2 border-l-[#023A2D]'
                                      : ''
                                  }
                                >
                                  <TableCell className="font-medium pl-8">
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
                                    <ClickableValue
                                      value={monthActualPOs}
                                      href={getProjectsLink('created', { month }, selectedYear)}
                                    />
                                  </TableCell>
                                  <TableCell className={`text-right text-sm ${poVarColor}`}>
                                    {poGoal > 0 ? formatVariance(monthActualPOs, poGoal) : <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right p-1 border-l border-l-muted-foreground/20">
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
                                    <ClickableValue
                                      value={monthActualInv}
                                      href={getProjectsLink('invoiced', { month }, selectedYear)}
                                    />
                                  </TableCell>
                                  <TableCell className={`text-right text-sm ${invVarColor}`}>
                                    {invGoal > 0 ? formatVariance(monthActualInv, invGoal) : <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-blue-600">
                                    <ClickableValue
                                      value={monthProjected}
                                      href={getProjectsLink('goal', { month }, selectedYear)}
                                      className="text-blue-600"
                                    />
                                  </TableCell>
                                  <TableCell className={`text-right text-sm font-medium ${forecastTextColor}`}>
                                    {forecast > 0 ? formatCurrency(forecast) : <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {invGoal > 0 ? (
                                      <div className="flex items-center gap-2 justify-end">
                                        <HealthBar value={forecast} max={invGoal} className="w-20" colorOverride={forecastBarColor} />
                                        <span className={`text-xs ${forecastTextColor}`}>
                                          {getPercentage(forecast, invGoal)}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="font-bold text-sm border-t-2 border-t-foreground/20">
                        <TableCell>Year Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(yearly.poGoal)}</TableCell>
                        <TableCell className="text-right">
                          <ClickableValue
                            value={yearly.actualPOs}
                            href={getProjectsLink('created', {}, selectedYear)}
                          />
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceColor(yearly.actualPOs, yearly.poGoal)}`}>
                          {yearly.poGoal > 0 ? formatVariance(yearly.actualPOs, yearly.poGoal) : '—'}
                        </TableCell>
                        <TableCell className="text-right border-l border-l-muted-foreground/20">{formatCurrency(yearly.invGoal)}</TableCell>
                        <TableCell className="text-right">
                          <ClickableValue
                            value={yearly.actualInv}
                            href={getProjectsLink('invoiced', {}, selectedYear)}
                          />
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceColor(yearly.actualInv, yearly.invGoal)}`}>
                          {yearly.invGoal > 0 ? formatVariance(yearly.actualInv, yearly.invGoal) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          <ClickableValue
                            value={yearly.projected}
                            href={getProjectsLink('goal', {}, selectedYear)}
                            className="text-blue-600"
                          />
                        </TableCell>
                        <TableCell className={`text-right ${getForecastHealthTextColor(yearly.forecast, yearly.invGoal)}`}>
                          {formatCurrency(yearly.forecast)}
                        </TableCell>
                        <TableCell className="text-right">
                          {yearly.invGoal > 0 ? (
                            <div className="flex items-center gap-2 justify-end">
                              <HealthBar value={yearly.forecast} max={yearly.invGoal} className="w-20" />
                              <span className={`text-xs ${getForecastHealthTextColor(yearly.forecast, yearly.invGoal)}`}>
                                {getPercentage(yearly.forecast, yearly.invGoal)}%
                              </span>
                            </div>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
                <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                  Underlined values link to matching projects. <span className="text-blue-600">Blue</span> = projected from active projects. Forecast = Invoiced + Projected.
                </div>
              </CardContent>
            </Card>

            {/* Invoice Goal Date by Month Chart */}
            <Card>
              <CardContent className="pt-5 px-4 pb-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Invoice Revenue by Month</h3>
                </div>
                <GoalChart
                  invoicedRevenue={invoicedRevenue}
                  projectedRevenue={projectedRevenue}
                  getMonthGoal={getMonthGoal}
                  currentMonth={isCurrentYear ? currentMonth : 13}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ============================================
// Revenue Goal Chart
// ============================================

function GoalChart({
  invoicedRevenue,
  projectedRevenue,
  getMonthGoal,
  currentMonth,
}: {
  invoicedRevenue: MonthlyData;
  projectedRevenue: MonthlyData;
  getMonthGoal: (month: number, field: 'revenue' | 'invoicedRevenue') => number;
  currentMonth: number;
}) {
  const data = MONTHS_SHORT.map((label, i) => {
    const month = i + 1;
    const goal = getMonthGoal(month, 'invoicedRevenue');
    const invoiced = invoicedRevenue[month] || 0;
    const projected = projectedRevenue[month] || 0;
    return {
      month: label,
      goal,
      invoiced,
      projected,
      forecast: invoiced + projected,
      isCurrent: month === currentMonth,
    };
  });

  const hasData = data.some(d => d.goal > 0 || d.invoiced > 0 || d.projected > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
        No revenue data for this year
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={0} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tick={{ fill: 'currentColor', fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'currentColor', fontSize: 11 }}
          tickLine={false}
          tickFormatter={(value) => value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`}
          width={60}
        />
        <RechartsTooltip
          formatter={(value, name) => [
            `$${Number(value ?? 0).toLocaleString()}`,
            name === 'invoiced' ? 'Invoiced' : name === 'projected' ? 'Projected' : name === 'goal' ? 'Goal' : String(name)
          ]}
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px' }}
          formatter={(value: string) => value === 'invoiced' ? 'Invoiced' : value === 'projected' ? 'Projected' : value === 'goal' ? 'Goal' : value}
        />
        <Bar dataKey="invoiced" fill="#10b981" stackId="revenue" radius={[0, 0, 0, 0]} />
        <Bar dataKey="projected" fill="#3b82f6" stackId="revenue" radius={[4, 4, 0, 0]} />
        <Bar dataKey="goal" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
