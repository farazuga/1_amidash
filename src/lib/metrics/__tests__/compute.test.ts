import { describe, it, expect } from 'vitest';
import type { MetricProject, MetricStatusHistoryItem, MetricRevenueGoal, ExcludedStatusIds } from '../types';
import {
  filterProjectsByCreatedDate,
  filterProjectsByInvoicedDate,
  filterActiveProjects,
  sumRevenue,
  computeInvoicedRevenue,
  computePosReceivedRevenue,
  computePipelineRevenue,
  computeGoalsForPeriod,
  computeAvgDaysToInvoice,
} from '../compute';

// ============================================
// TEST DATA
// ============================================

const INVOICED_STATUS_ID = 'status-invoiced';
const CANCELLED_STATUS_ID = 'status-cancelled';
const ACTIVE_STATUS_ID = 'status-active';
const DESIGN_STATUS_ID = 'status-design';

const excludedStatuses: ExcludedStatusIds = {
  invoicedStatusId: INVOICED_STATUS_ID,
  cancelledStatusId: CANCELLED_STATUS_ID,
};

// March 2026 range
const marchRange = {
  start: new Date(2026, 2, 1),
  end: new Date(2026, 2, 31, 23, 59, 59, 999),
};

function makeProject(overrides: Partial<MetricProject> & { id: string }): MetricProject {
  return {
    sales_amount: null,
    created_date: null,
    invoiced_date: null,
    current_status_id: ACTIVE_STATUS_ID,
    ...overrides,
  };
}

const sampleProjects: MetricProject[] = [
  // PO received in March, invoiced in March
  makeProject({ id: 'p1', sales_amount: 50000, created_date: '2026-03-05', invoiced_date: '2026-03-20', current_status_id: INVOICED_STATUS_ID }),
  // PO received in March, not yet invoiced
  makeProject({ id: 'p2', sales_amount: 30000, created_date: '2026-03-10', current_status_id: ACTIVE_STATUS_ID }),
  // PO received in February, invoiced in March
  makeProject({ id: 'p3', sales_amount: 45000, created_date: '2026-02-15', invoiced_date: '2026-03-25', current_status_id: INVOICED_STATUS_ID }),
  // PO received in January, invoiced in February
  makeProject({ id: 'p4', sales_amount: 20000, created_date: '2026-01-10', invoiced_date: '2026-02-28', current_status_id: INVOICED_STATUS_ID }),
  // Active project from December
  makeProject({ id: 'p5', sales_amount: 75000, created_date: '2025-12-01', current_status_id: DESIGN_STATUS_ID }),
  // Cancelled project
  makeProject({ id: 'p6', sales_amount: 10000, created_date: '2026-03-01', current_status_id: CANCELLED_STATUS_ID }),
  // Project with null sales_amount
  makeProject({ id: 'p7', sales_amount: null, created_date: '2026-03-12', current_status_id: ACTIVE_STATUS_ID }),
];

const sampleStatusHistory: MetricStatusHistoryItem[] = [
  { project_id: 'p1', changed_at: '2026-03-20T14:00:00Z', status: { name: 'Invoiced' } },
  { project_id: 'p3', changed_at: '2026-03-25T10:00:00Z', status: { name: 'Invoiced' } },
  { project_id: 'p4', changed_at: '2026-02-28T16:00:00Z', status: { name: 'Invoiced' } },
];

const sampleGoals: MetricRevenueGoal[] = [
  { year: 2026, month: 1, revenue_goal: 100000, invoiced_revenue_goal: 80000 },
  { year: 2026, month: 2, revenue_goal: 120000, invoiced_revenue_goal: 90000 },
  { year: 2026, month: 3, revenue_goal: 150000, invoiced_revenue_goal: 110000 },
];

// ============================================
// TESTS
// ============================================

describe('filterProjectsByCreatedDate', () => {
  it('filters projects by created_date within range', () => {
    const result = filterProjectsByCreatedDate(sampleProjects, marchRange);
    // p1 (Mar 5), p2 (Mar 10), p6 (Mar 1), p7 (Mar 12)
    expect(result.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p6', 'p7']);
  });

  it('excludes projects with null created_date', () => {
    const projects = [makeProject({ id: 'x', created_date: null })];
    expect(filterProjectsByCreatedDate(projects, marchRange)).toHaveLength(0);
  });

  it('handles boundary dates (first and last day of month)', () => {
    const projects = [
      makeProject({ id: 'first', created_date: '2026-03-01' }),
      makeProject({ id: 'last', created_date: '2026-03-31' }),
      makeProject({ id: 'outside', created_date: '2026-04-01' }),
    ];
    const result = filterProjectsByCreatedDate(projects, marchRange);
    expect(result.map(p => p.id)).toEqual(['first', 'last']);
  });
});

describe('filterProjectsByInvoicedDate', () => {
  it('filters projects by invoiced_date within range', () => {
    const result = filterProjectsByInvoicedDate(sampleProjects, marchRange);
    // p1 (Mar 20), p3 (Mar 25)
    expect(result.map(p => p.id).sort()).toEqual(['p1', 'p3']);
  });

  it('excludes projects with null invoiced_date', () => {
    const result = filterProjectsByInvoicedDate(sampleProjects, marchRange);
    expect(result.every(p => p.invoiced_date !== null)).toBe(true);
  });
});

describe('sumRevenue', () => {
  it('sums sales_amount, treating null as 0', () => {
    const projects = [
      makeProject({ id: 'a', sales_amount: 100 }),
      makeProject({ id: 'b', sales_amount: 200 }),
      makeProject({ id: 'c', sales_amount: null }),
    ];
    expect(sumRevenue(projects)).toBe(300);
  });

  it('returns 0 for empty array', () => {
    expect(sumRevenue([])).toBe(0);
  });
});

describe('computePosReceivedRevenue', () => {
  it('sums sales_amount for projects with created_date in range', () => {
    // p1: 50000, p2: 30000, p6: 10000, p7: null (0)
    expect(computePosReceivedRevenue(sampleProjects, marchRange)).toBe(90000);
  });
});

describe('computeInvoicedRevenue', () => {
  it('sums sales_amount for projects with invoiced_date in range', () => {
    // p1: 50000, p3: 45000
    expect(computeInvoicedRevenue(sampleProjects, marchRange)).toBe(95000);
  });

  it('uses invoiced_date NOT updated_at (canonical definition)', () => {
    const projects = [
      makeProject({ id: 'test', sales_amount: 100, invoiced_date: '2026-03-15' }),
    ];
    expect(computeInvoicedRevenue(projects, marchRange)).toBe(100);
  });
});

describe('filterActiveProjects', () => {
  it('excludes Invoiced and Cancelled projects', () => {
    const result = filterActiveProjects(sampleProjects, excludedStatuses);
    // p2 (active), p5 (design), p7 (active)
    expect(result.map(p => p.id).sort()).toEqual(['p2', 'p5', 'p7']);
  });

  it('includes projects with null status ID', () => {
    const projects = [makeProject({ id: 'null-status', current_status_id: null })];
    const result = filterActiveProjects(projects, excludedStatuses);
    expect(result).toHaveLength(1);
  });

  it('handles undefined excluded status IDs gracefully', () => {
    const result = filterActiveProjects(sampleProjects, {});
    expect(result).toHaveLength(sampleProjects.length);
  });
});

describe('computePipelineRevenue', () => {
  it('sums sales_amount of active projects', () => {
    // p2: 30000, p5: 75000, p7: null (0)
    expect(computePipelineRevenue(sampleProjects, excludedStatuses)).toBe(105000);
  });
});

describe('computeAvgDaysToInvoice', () => {
  it('computes average days from created_date to invoiced status_history entry', () => {
    // p1: created_date 2026-03-05, invoiced status_history 2026-03-20T14:00:00Z
    //     diff = ~15.58 days
    // p3: created_date 2026-02-15, invoiced status_history 2026-03-25T10:00:00Z
    //     diff = ~38.42 days
    // p4: created_date 2026-01-10, invoiced status_history 2026-02-28T16:00:00Z
    //     diff = ~49.67 days
    // avg ≈ 34.56 → rounds to 35
    const result = computeAvgDaysToInvoice(sampleProjects, sampleStatusHistory);
    expect(result).toBeGreaterThanOrEqual(34);
    expect(result).toBeLessThanOrEqual(35);
  });

  it('returns 0 when no projects have matching status history', () => {
    const result = computeAvgDaysToInvoice(sampleProjects, []);
    expect(result).toBe(0);
  });

  it('returns 0 for empty projects', () => {
    expect(computeAvgDaysToInvoice([], sampleStatusHistory)).toBe(0);
  });
});

describe('computeGoalsForPeriod', () => {
  it('returns single month goal', () => {
    const result = computeGoalsForPeriod(sampleGoals, {
      periodType: 'month',
      selectedYear: 2026,
      selectedMonth: 3,
      selectedQuarter: 1,
    });
    expect(result.revenue).toBe(150000);
    expect(result.invoicedRevenue).toBe(110000);
  });

  it('sums quarter goals (3 months)', () => {
    const result = computeGoalsForPeriod(sampleGoals, {
      periodType: 'quarter',
      selectedYear: 2026,
      selectedMonth: 3,
      selectedQuarter: 1,
    });
    // 100000 + 120000 + 150000 = 370000
    expect(result.revenue).toBe(370000);
    // 80000 + 90000 + 110000 = 280000
    expect(result.invoicedRevenue).toBe(280000);
  });

  it('returns 0 for months without goals', () => {
    const result = computeGoalsForPeriod(sampleGoals, {
      periodType: 'month',
      selectedYear: 2026,
      selectedMonth: 6,
      selectedQuarter: 2,
    });
    expect(result.revenue).toBe(0);
    expect(result.invoicedRevenue).toBe(0);
  });

  it('handles empty goals array', () => {
    const result = computeGoalsForPeriod([], {
      periodType: 'month',
      selectedYear: 2026,
      selectedMonth: 3,
      selectedQuarter: 1,
    });
    expect(result.revenue).toBe(0);
  });
});
