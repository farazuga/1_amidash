import type {
  DateRange,
  PeriodParams,
  MetricProject,
  MetricStatusHistoryItem,
  MetricRevenueGoal,
  PeriodGoals,
  ExcludedStatusIds,
} from './types';

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Return projects whose `invoiced_date` falls within the given date range.
 */
export function filterProjectsByInvoicedDate<T extends MetricProject>(
  projects: T[],
  range: DateRange,
): T[] {
  return projects.filter((p) => {
    if (!p.invoiced_date) return false;
    const invoicedDate = new Date(p.invoiced_date + 'T00:00:00');
    return invoicedDate >= range.start && invoicedDate <= range.end;
  });
}

/**
 * Return projects whose `created_date` (PO received date) falls within the
 * given date range.
 */
export function filterProjectsByCreatedDate<T extends MetricProject>(
  projects: T[],
  range: DateRange,
): T[] {
  return projects.filter((p) => {
    if (!p.created_date) return false;
    const createdDate = new Date(p.created_date + 'T00:00:00');
    return createdDate >= range.start && createdDate <= range.end;
  });
}

/**
 * Return projects that are currently active (not invoiced, not cancelled).
 */
export function filterActiveProjects<T extends MetricProject>(
  projects: T[],
  excluded: ExcludedStatusIds,
): T[] {
  return projects.filter((p) => {
    if (excluded.invoicedStatusId && p.current_status_id === excluded.invoicedStatusId) return false;
    if (excluded.cancelledStatusId && p.current_status_id === excluded.cancelledStatusId) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Revenue computations
// ---------------------------------------------------------------------------

/**
 * Sum `sales_amount` across a set of projects.
 */
export function sumRevenue<T extends MetricProject>(projects: T[]): number {
  return projects.reduce((sum, p) => sum + (p.sales_amount || 0), 0);
}

/** Convenience: invoiced revenue = sum of sales_amount for invoiced-in-period projects. */
export function computeInvoicedRevenue<T extends MetricProject>(
  projects: T[],
  range: DateRange,
): number {
  return sumRevenue(filterProjectsByInvoicedDate(projects, range));
}

/** Convenience: POs received revenue = sum of sales_amount for created-in-period projects. */
export function computePosReceivedRevenue<T extends MetricProject>(
  projects: T[],
  range: DateRange,
): number {
  return sumRevenue(filterProjectsByCreatedDate(projects, range));
}

/** Pipeline revenue = sum of sales_amount for active (non-invoiced/cancelled) projects. */
export function computePipelineRevenue<T extends MetricProject>(
  projects: T[],
  excluded: ExcludedStatusIds,
): number {
  return sumRevenue(filterActiveProjects(projects, excluded));
}

// ---------------------------------------------------------------------------
// Goal computations
// ---------------------------------------------------------------------------

/**
 * Aggregate revenue goals for the given period.
 */
export function computeGoalsForPeriod(
  goals: MetricRevenueGoal[],
  params: PeriodParams,
): PeriodGoals {
  const { periodType, selectedYear, selectedMonth, selectedQuarter } = params;

  if (periodType === 'month') {
    const goal = goals.find((g) => g.year === selectedYear && g.month === selectedMonth);
    return {
      revenue: goal?.revenue_goal || 0,
      invoicedRevenue: goal?.invoiced_revenue_goal || 0,
    };
  }

  if (periodType === 'quarter') {
    const startMonth = (selectedQuarter - 1) * 3 + 1;
    let revenue = 0;
    let invoicedRevenue = 0;
    for (let m = startMonth; m < startMonth + 3; m++) {
      const goal = goals.find((g) => g.year === selectedYear && g.month === m);
      revenue += goal?.revenue_goal || 0;
      invoicedRevenue += goal?.invoiced_revenue_goal || 0;
    }
    return { revenue, invoicedRevenue };
  }

  if (periodType === 'ytd') {
    const now = new Date();
    const endMonth = selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12;
    let revenue = 0;
    let invoicedRevenue = 0;
    for (let m = 1; m <= endMonth; m++) {
      const goal = goals.find((g) => g.year === selectedYear && g.month === m);
      revenue += goal?.revenue_goal || 0;
      invoicedRevenue += goal?.invoiced_revenue_goal || 0;
    }
    return { revenue, invoicedRevenue };
  }

  // 'last12' (or any other)
  const now = new Date();
  let revenue = 0;
  let invoicedRevenue = 0;
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const goal = goals.find((g) => g.year === date.getFullYear() && g.month === date.getMonth() + 1);
    revenue += goal?.revenue_goal || 0;
    invoicedRevenue += goal?.invoiced_revenue_goal || 0;
  }
  return { revenue, invoicedRevenue };
}

// ---------------------------------------------------------------------------
// Days-to-invoice
// ---------------------------------------------------------------------------

/**
 * Average number of calendar days from `created_date` to the Invoiced
 * status-history entry, across all projects that have both.
 */
export function computeAvgDaysToInvoice(
  projects: MetricProject[],
  statusHistory: MetricStatusHistoryItem[],
): number {
  const invoiceTimesMs: number[] = [];

  projects.forEach((project) => {
    const createdDate = project.created_date ? new Date(project.created_date) : null;
    const invoicedEntry = statusHistory.find(
      (h) => h.project_id === project.id && h.status?.name === 'Invoiced',
    );

    if (createdDate && invoicedEntry) {
      const invoicedAt = new Date(invoicedEntry.changed_at);
      invoiceTimesMs.push(invoicedAt.getTime() - createdDate.getTime());
    }
  });

  return invoiceTimesMs.length > 0
    ? Math.round(
        invoiceTimesMs.reduce((a, b) => a + b, 0) /
          invoiceTimesMs.length /
          (1000 * 60 * 60 * 24),
      )
    : 0;
}
