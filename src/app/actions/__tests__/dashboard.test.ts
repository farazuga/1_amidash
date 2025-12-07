import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardData } from '../dashboard';
import type {
  DashboardProject,
  DashboardStatus,
  DashboardStatusHistoryItem,
  DashboardRevenueGoal,
} from '../dashboard';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('dashboard.ts - getDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return all dashboard data successfully', async () => {
    // Arrange
    const mockProjects: DashboardProject[] = [
      {
        id: 'proj-1',
        client_name: 'Client A',
        sales_amount: 50000,
        goal_completion_date: '2024-12-31',
        current_status_id: 'status-1',
        created_at: '2024-01-01T00:00:00Z',
        current_status: { id: 'status-1', name: 'In Progress' },
      },
      {
        id: 'proj-2',
        client_name: 'Client B',
        sales_amount: 75000,
        goal_completion_date: '2024-11-30',
        current_status_id: 'status-2',
        created_at: '2024-02-01T00:00:00Z',
        current_status: { id: 'status-2', name: 'Completed' },
      },
    ];

    const mockStatuses: DashboardStatus[] = [
      { id: 'status-1', name: 'In Progress', display_order: 1 },
      { id: 'status-2', name: 'Completed', display_order: 2 },
      { id: 'status-3', name: 'On Hold', display_order: 3 },
    ];

    const mockHistory: DashboardStatusHistoryItem[] = [
      {
        id: 'hist-1',
        project_id: 'proj-1',
        status_id: 'status-1',
        changed_at: '2024-03-15T10:30:00Z',
        status: { name: 'In Progress' },
        project: { id: 'proj-1', client_name: 'Client A', sales_amount: 50000 },
      },
      {
        id: 'hist-2',
        project_id: 'proj-2',
        status_id: 'status-2',
        changed_at: '2024-03-14T09:00:00Z',
        status: { name: 'Completed' },
        project: { id: 'proj-2', client_name: 'Client B', sales_amount: 75000 },
      },
    ];

    const mockGoals: DashboardRevenueGoal[] = [
      { year: 2024, month: 1, revenue_goal: 100000, projects_goal: 5 },
      { year: 2024, month: 2, revenue_goal: 120000, projects_goal: 6 },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockProjects,
              error: null,
            }),
          };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockStatuses,
                error: null,
              }),
            }),
          };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockHistory,
                error: null,
              }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockGoals,
              error: null,
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getDashboardData();

    // Assert
    expect(result).toEqual({
      projects: mockProjects,
      statuses: mockStatuses,
      statusHistory: mockHistory,
      goals: mockGoals,
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('projects');
    expect(mockSupabase.from).toHaveBeenCalledWith('statuses');
    expect(mockSupabase.from).toHaveBeenCalledWith('status_history');
  });

  it('should return empty arrays when no data exists', async () => {
    // Arrange
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getDashboardData();

    // Assert
    expect(result).toEqual({
      projects: [],
      statuses: [],
      statusHistory: [],
      goals: [],
    });
  });

  it('should return empty arrays when data is null', async () => {
    // Arrange
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return {
            select: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getDashboardData();

    // Assert
    expect(result).toEqual({
      projects: [],
      statuses: [],
      statusHistory: [],
      goals: [],
    });
  });

  it('should handle partial data fetch failures gracefully', async () => {
    // Arrange - projects fails, others succeed
    const mockStatuses: DashboardStatus[] = [
      { id: 'status-1', name: 'Active', display_order: 1 },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Projects fetch failed' },
            }),
          };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockStatuses,
                error: null,
              }),
            }),
          };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getDashboardData();

    // Assert - should still return data for successful queries
    expect(result.projects).toEqual([]);
    expect(result.statuses).toEqual(mockStatuses);
    expect(result.statusHistory).toEqual([]);
    expect(result.goals).toEqual([]);
  });

  it('should fetch projects with status relations', async () => {
    // Arrange
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'proj-1',
          client_name: 'Test Client',
          current_status: { id: 'status-1', name: 'Active' },
        },
      ],
      error: null,
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockSelect };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await getDashboardData();

    // Assert
    expect(mockSelect).toHaveBeenCalledWith('*, current_status:statuses(*)');
  });

  it('should fetch statuses ordered by display_order', async () => {
    // Arrange
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'status-1', name: 'First', display_order: 1 },
        { id: 'status-2', name: 'Second', display_order: 2 },
      ],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'statuses') {
          return { select: mockSelect };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await getDashboardData();

    // Assert
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockOrder).toHaveBeenCalledWith('display_order');
  });

  it('should fetch status history ordered by changed_at descending', async () => {
    // Arrange
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'hist-1', changed_at: '2024-03-15T00:00:00Z' },
        { id: 'hist-2', changed_at: '2024-03-14T00:00:00Z' },
      ],
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'status_history') {
          return { select: mockSelect };
        }
        if (table === 'revenue_goals') {
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await getDashboardData();

    // Assert
    expect(mockSelect).toHaveBeenCalledWith(
      '*, status:statuses(*), project:projects(id, client_name, sales_amount)'
    );
    expect(mockOrder).toHaveBeenCalledWith('changed_at', { ascending: false });
  });

  it('should handle createClient failure', async () => {
    // Arrange
    vi.mocked(createClient).mockRejectedValue(
      new Error('Failed to create Supabase client')
    );

    // Act & Assert
    await expect(getDashboardData()).rejects.toThrow('Failed to create Supabase client');
  });

  it('should execute all queries in parallel using Promise.all', async () => {
    // Arrange
    const executionOrder: string[] = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockImplementation(async () => {
              executionOrder.push('projects-start');
              await new Promise(resolve => setTimeout(resolve, 10));
              executionOrder.push('projects-end');
              return { data: [], error: null };
            }),
          };
        }
        if (table === 'statuses') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(async () => {
                executionOrder.push('statuses-start');
                await new Promise(resolve => setTimeout(resolve, 10));
                executionOrder.push('statuses-end');
                return { data: [], error: null };
              }),
            }),
          };
        }
        if (table === 'status_history') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(async () => {
                executionOrder.push('history-start');
                await new Promise(resolve => setTimeout(resolve, 10));
                executionOrder.push('history-end');
                return { data: [], error: null };
              }),
            }),
          };
        }
        if (table === 'revenue_goals') {
          return {
            select: vi.fn().mockImplementation(async () => {
              executionOrder.push('goals-start');
              await new Promise(resolve => setTimeout(resolve, 10));
              executionOrder.push('goals-end');
              return { data: [], error: null };
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await getDashboardData();

    // Assert - all queries should start before any finish (parallel execution)
    const allStarts = executionOrder.filter(item => item.endsWith('-start'));
    const firstEnd = executionOrder.findIndex(item => item.endsWith('-end'));

    expect(allStarts.length).toBe(4); // All 4 queries started
    expect(firstEnd).toBeGreaterThan(3); // First end happens after all starts
  });

  it('should return correct TypeScript types for all fields', async () => {
    // Arrange
    const mockProjects: DashboardProject[] = [
      {
        id: 'proj-1',
        client_name: 'Client',
        sales_amount: 100,
        goal_completion_date: '2024-12-31',
        current_status_id: 'status-1',
        created_at: '2024-01-01T00:00:00Z',
        current_status: { id: 'status-1', name: 'Active' },
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockProjects, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getDashboardData();

    // Assert - TypeScript should enforce correct types
    expect(result.projects[0].id).toBe('proj-1');
    expect(result.projects[0].client_name).toBe('Client');
    expect(result.projects[0].sales_amount).toBe(100);
    expect(result.projects[0].current_status?.name).toBe('Active');
  });
});
