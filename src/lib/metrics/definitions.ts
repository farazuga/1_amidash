/**
 * Shared Metrics Library — Metric Definitions
 *
 * Human-readable metadata for each metric.
 * Used for tooltips, labels, and documentation.
 */

import type { MetricKey } from './types';

export interface MetricDefinition {
  key: MetricKey;
  displayName: string;
  description: string;
  unit: 'currency' | 'count' | 'days' | 'percentage';
  /** The canonical date field used for this metric */
  dateField: string | null;
  /** What NOT to use (common mistakes) */
  notFields?: string[];
}

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  posReceivedRevenue: {
    key: 'posReceivedRevenue',
    displayName: 'POs Received ($)',
    description: 'SUM(sales_amount) WHERE created_date in period',
    unit: 'currency',
    dateField: 'created_date',
    notFields: ['created_at'],
  },
  posReceivedCount: {
    key: 'posReceivedCount',
    displayName: 'POs Received (#)',
    description: 'COUNT(*) WHERE created_date in period',
    unit: 'count',
    dateField: 'created_date',
    notFields: ['created_at'],
  },
  invoicedRevenue: {
    key: 'invoicedRevenue',
    displayName: 'Invoiced Revenue ($)',
    description: 'SUM(sales_amount) WHERE invoiced_date in period',
    unit: 'currency',
    dateField: 'invoiced_date',
    notFields: ['updated_at', 'status_history.changed_at'],
  },
  invoicedCount: {
    key: 'invoicedCount',
    displayName: 'Invoiced (#)',
    description: 'COUNT(*) WHERE invoiced_date in period',
    unit: 'count',
    dateField: 'invoiced_date',
    notFields: ['updated_at'],
  },
  activeProjectCount: {
    key: 'activeProjectCount',
    displayName: 'Active Projects',
    description: 'COUNT(*) WHERE status NOT IN (Invoiced, Cancelled)',
    unit: 'count',
    dateField: null,
  },
  pipelineRevenue: {
    key: 'pipelineRevenue',
    displayName: 'Pipeline Value ($)',
    description: 'SUM(sales_amount) of active projects',
    unit: 'currency',
    dateField: null,
  },
  avgDaysToInvoice: {
    key: 'avgDaysToInvoice',
    displayName: 'Avg Days to Invoice',
    description: 'AVG(invoiced_date - created_date) for projects with both dates',
    unit: 'days',
    dateField: null,
  },
  revenueGoal: {
    key: 'revenueGoal',
    displayName: 'Revenue Goal ($)',
    description: 'From revenue_goals.revenue_goal, summed for period',
    unit: 'currency',
    dateField: null,
    notFields: ['amount'],
  },
  invoicedRevenueGoal: {
    key: 'invoicedRevenueGoal',
    displayName: 'Invoiced Revenue Goal ($)',
    description: 'From revenue_goals.invoiced_revenue_goal, summed for period',
    unit: 'currency',
    dateField: null,
  },
  projectsGoal: {
    key: 'projectsGoal',
    displayName: 'Projects Goal (#)',
    description: 'From revenue_goals.projects_goal, summed for period',
    unit: 'count',
    dateField: null,
  },
  openQuotesTotal: {
    key: 'openQuotesTotal',
    displayName: 'Open Quotes ($)',
    description: 'SUM of Odoo draft/sent quotes (not expired)',
    unit: 'currency',
    dateField: null,
  },
  odooAccountBalance: {
    key: 'odooAccountBalance',
    displayName: 'Odoo Account Balance',
    description: 'Movement or balance from Odoo accounting',
    unit: 'currency',
    dateField: null,
  },
};
