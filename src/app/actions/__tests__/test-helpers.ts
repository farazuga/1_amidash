/**
 * Test Helpers for Server Actions
 *
 * This file contains utility functions to create mock Supabase clients
 * and common test data for server action tests.
 */

import { vi } from 'vitest';
import type { createClient } from '@/lib/supabase/server';

/**
 * Creates a mock Supabase client with auth functionality
 */
export function createMockSupabaseAuth(options: {
  user?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  profileError?: Record<string, unknown> | null;
}) {
  const { user = null, error = null, profile = null, profileError = null } = options;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error,
      }),
      signOut: vi.fn().mockResolvedValue({ error }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: profile,
                error: profileError,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

/**
 * Creates a mock Supabase client for dashboard queries
 */
export function createMockSupabaseDashboard(options: {
  projects?: unknown[] | null;
  projectsError?: Record<string, unknown> | null;
  statuses?: unknown[] | null;
  statusesError?: Record<string, unknown> | null;
  statusHistory?: unknown[] | null;
  statusHistoryError?: Record<string, unknown> | null;
  goals?: unknown[] | null;
  goalsError?: Record<string, unknown> | null;
}) {
  const {
    projects = [],
    projectsError = null,
    statuses = [],
    statusesError = null,
    statusHistory = [],
    statusHistoryError = null,
    goals = [],
    goalsError = null,
  } = options;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn().mockResolvedValue({
            data: projects,
            error: projectsError,
          }),
        };
      }
      if (table === 'statuses') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: statuses,
              error: statusesError,
            }),
          }),
        };
      }
      if (table === 'status_history') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: statusHistory,
              error: statusHistoryError,
            }),
          }),
        };
      }
      if (table === 'revenue_goals') {
        return {
          select: vi.fn().mockResolvedValue({
            data: goals,
            error: goalsError,
          }),
        };
      }
      return { select: vi.fn() };
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

/**
 * Creates a mock user object
 */
export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock profile object
 */
export function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-user-id',
    full_name: 'Test User',
    role: 'admin',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock project object
 */
export function createMockProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-project-id',
    client_name: 'Test Client',
    sales_amount: 50000,
    goal_completion_date: '2024-12-31',
    current_status_id: 'status-1',
    created_at: '2024-01-01T00:00:00Z',
    current_status: { id: 'status-1', name: 'In Progress' },
    ...overrides,
  };
}

/**
 * Creates a mock status object
 */
export function createMockStatus(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-status-id',
    name: 'Test Status',
    display_order: 1,
    ...overrides,
  };
}

/**
 * Creates a mock status history item
 */
export function createMockStatusHistory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-history-id',
    project_id: 'test-project-id',
    status_id: 'test-status-id',
    changed_at: '2024-01-01T00:00:00Z',
    status: { name: 'Test Status' },
    project: {
      id: 'test-project-id',
      client_name: 'Test Client',
      sales_amount: 50000,
    },
    ...overrides,
  };
}

/**
 * Creates a mock revenue goal object
 */
export function createMockRevenueGoal(overrides: Record<string, unknown> = {}) {
  return {
    year: 2024,
    month: 1,
    revenue_goal: 100000,
    projects_goal: 5,
    ...overrides,
  };
}

/**
 * Creates multiple mock objects using a factory function
 */
export function createMockArray<T>(
  factory: (index: number) => T,
  count: number
): T[] {
  return Array.from({ length: count }, (_, index) => factory(index));
}

