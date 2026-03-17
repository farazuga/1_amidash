/**
 * Test data builders for creating consistent test fixtures
 */

import { ActiveProject, InvoicedProject } from '../../data/fetchers/projects';
import { RecentPO, HighlightPO } from '../../data/fetchers/pos';
import { RevenueData } from '../../data/fetchers/revenue';
import { BlocksConfig, SignageBlock } from '../../data/fetchers/blocks-config';

// Project builders
export function buildActiveProject(overrides: Partial<ActiveProject> = {}): ActiveProject {
  return {
    id: '1',
    name: 'Test Project',
    client_name: 'Test Client',
    status: 'In Progress',
    status_color: '#3b82f6',
    project_type: 'Integration',
    salesperson: 'John Doe',
    start_date: '2024-01-01',
    due_date: '2024-06-01',
    total_value: 50000,
    ...overrides,
  };
}

export function buildActiveProjects(count: number = 3): ActiveProject[] {
  return Array.from({ length: count }, (_, i) =>
    buildActiveProject({
      id: `${i + 1}`,
      name: `Project ${i + 1}`,
      client_name: `Client ${String.fromCharCode(65 + i)}`,
      total_value: 10000 * (i + 1),
    })
  );
}

// PO builders
export function buildRecentPO(overrides: Partial<RecentPO> = {}): RecentPO {
  return {
    id: '1',
    po_number: 'PO-2024-001',
    project_name: 'Website Redesign',
    client_name: 'Acme Corp',
    amount: 15000,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function buildRecentPOs(count: number = 3): RecentPO[] {
  return Array.from({ length: count }, (_, i) =>
    buildRecentPO({
      id: `${i + 1}`,
      po_number: `PO-2024-${String(i + 1).padStart(3, '0')}`,
      project_name: `Project ${i + 1}`,
      amount: 5000 * (i + 1),
    })
  );
}

// HighlightPO builders
export function buildHighlightPO(overrides: Partial<HighlightPO> = {}): HighlightPO {
  return {
    id: '1',
    po_number: 'PO-2024-001',
    project_name: 'Website Redesign',
    client_name: 'Acme Corp',
    amount: 15000,
    created_at: new Date().toISOString(),
    highlight_reason: 'newest',
    ...overrides,
  };
}

// InvoicedProject builders
export function buildInvoicedProject(overrides: Partial<InvoicedProject> = {}): InvoicedProject {
  return {
    id: 'inv-1',
    name: 'Lobby Display Install',
    client_name: 'Marriott Downtown',
    total_value: 45000,
    completed_at: '2026-03-12T10:00:00Z',
    ...overrides,
  };
}

// Revenue builders
export function buildRevenueData(overrides: Partial<RevenueData> = {}): RevenueData {
  return {
    currentMonthRevenue: 125000,
    currentMonthGoal: 150000,
    quarterRevenue: 370000,
    quarterGoal: 375000,
    yearToDateRevenue: 1250000,
    yearToDateGoal: 1500000,
    monthlyData: [
      { month: 'Jan', revenue: 120000, goal: 125000 },
      { month: 'Feb', revenue: 135000, goal: 125000 },
      { month: 'Mar', revenue: 115000, goal: 125000 },
      { month: 'Apr', revenue: 140000, goal: 125000 },
      { month: 'May', revenue: 130000, goal: 125000 },
      { month: 'Jun', revenue: 125000, goal: 150000 },
      { month: 'Jul', revenue: 0, goal: 150000 },
      { month: 'Aug', revenue: 0, goal: 150000 },
      { month: 'Sep', revenue: 0, goal: 150000 },
      { month: 'Oct', revenue: 0, goal: 150000 },
      { month: 'Nov', revenue: 0, goal: 150000 },
      { month: 'Dec', revenue: 0, goal: 175000 },
    ],
    ...overrides,
  };
}

// Blocks config builders
export function buildSignageBlock(overrides: Partial<SignageBlock> = {}): SignageBlock {
  return {
    id: '1',
    block_type: 'po-highlight',
    title: 'Recent Purchase Orders',
    content: {},
    enabled: true,
    position: 'left',
    display_order: 0,
    ...overrides,
  };
}

export function buildBlocksConfig(overrides: Partial<BlocksConfig> = {}): BlocksConfig {
  return {
    blocks: [
      buildSignageBlock({ id: '1', block_type: 'po-highlight', position: 'left', display_order: 0 }),
      buildSignageBlock({ id: '2', block_type: 'projects-invoiced', title: 'Projects Invoiced', position: 'right', display_order: 1 }),
      buildSignageBlock({ id: '3', block_type: 'quick-stats', title: 'Quick Stats', position: 'both', display_order: 2 }),
    ],
    settings: { rotation_interval_ms: 15000 },
    ...overrides,
  };
}

// Supabase mock response builders
export function buildSupabaseResponse<T>(data: T | null, error: Error | null = null) {
  return { data, error };
}

export function buildSupabaseError(message: string, code: string = 'PGRST000') {
  return {
    data: null,
    error: { message, code, details: null, hint: null },
  };
}
