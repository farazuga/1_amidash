/**
 * Test data builders for creating consistent test fixtures
 */

import { ActiveProject } from '../../data/fetchers/projects';
import { RecentPO } from '../../data/fetchers/pos';
import { RevenueData } from '../../data/fetchers/revenue';
import { ScheduleEntry } from '../../data/fetchers/schedule';
import { ProjectMetrics } from '../../data/fetchers/metrics';
import { SignageSlide } from '../../data/fetchers/slide-config';

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

// Revenue builders
export function buildRevenueData(overrides: Partial<RevenueData> = {}): RevenueData {
  return {
    currentMonthRevenue: 125000,
    currentMonthGoal: 150000,
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

// Schedule builders
export function buildScheduleEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    userId: '1',
    userName: 'Alice Johnson',
    assignments: [
      {
        projectId: 'p1',
        projectName: 'Website Redesign',
        projectColor: '#3b82f6',
        date: '2024-01-15',
        hours: 8,
      },
    ],
    ...overrides,
  };
}

export function buildScheduleEntries(count: number = 3): ScheduleEntry[] {
  const names = ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eve Davis'];
  return Array.from({ length: count }, (_, i) =>
    buildScheduleEntry({
      userId: `${i + 1}`,
      userName: names[i % names.length],
    })
  );
}

// Metrics builders
export function buildProjectMetrics(overrides: Partial<ProjectMetrics> = {}): ProjectMetrics {
  return {
    total: 50,
    byStatus: [
      { status_name: 'In Progress', status_color: '#3b82f6', count: 20 },
      { status_name: 'Complete', status_color: '#10b981', count: 25 },
      { status_name: 'Pending', status_color: '#6b7280', count: 5 },
    ],
    byType: [
      { type_name: 'Integration', count: 30 },
      { type_name: 'Development', count: 20 },
    ],
    completedThisWeek: 5,
    completedThisMonth: 15,
    upcomingDeadlines: 3,
    overdueCount: 2,
    ...overrides,
  };
}

// Slide config builders
export function buildSignageSlide(overrides: Partial<SignageSlide> = {}): SignageSlide {
  return {
    id: '1',
    slide_type: 'active-projects',
    title: null,
    enabled: true,
    display_order: 1,
    duration_ms: 15000,
    config: {},
    ...overrides,
  };
}

export function buildSignageSlides(count: number = 4): SignageSlide[] {
  const types = ['active-projects', 'revenue-dashboard', 'po-ticker', 'team-schedule'] as const;
  return Array.from({ length: count }, (_, i) =>
    buildSignageSlide({
      id: `${i + 1}`,
      slide_type: types[i % types.length],
      display_order: i + 1,
    })
  );
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
