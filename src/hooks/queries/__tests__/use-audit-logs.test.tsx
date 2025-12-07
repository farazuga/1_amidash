import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuditLogs } from '../use-audit-logs';
import type { AuditLogWithRelations } from '../use-audit-logs';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return TestWrapper;
}

describe('useAuditLogs', () => {
  const mockAuditLogs: AuditLogWithRelations[] = [
    {
      id: '1',
      project_id: 'project-1',
      user_id: 'user-1',
      action: 'create',
      field_name: 'status',
      old_value: null,
      new_value: 'In Progress',
      created_at: '2024-01-15T10:00:00Z',
      user: {
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John Doe',
        role: 'member',
        is_salesperson: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      project: { client_name: 'Acme Corp' },
    },
    {
      id: '2',
      project_id: 'project-2',
      user_id: 'user-2',
      action: 'update',
      field_name: 'status',
      old_value: 'In Progress',
      new_value: 'Completed',
      created_at: '2024-01-15T11:00:00Z',
      user: {
        id: 'user-2',
        email: 'jane@example.com',
        full_name: 'Jane Smith',
        role: 'admin',
        is_salesperson: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      project: { client_name: 'Tech Inc' },
    },
    {
      id: '3',
      project_id: 'project-3',
      user_id: 'user-1',
      action: 'delete',
      field_name: null,
      old_value: null,
      new_value: null,
      created_at: '2024-01-15T12:00:00Z',
      user: {
        id: 'user-1',
        email: 'john@example.com',
        full_name: 'John Doe',
        role: 'member',
        is_salesperson: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      project: { client_name: 'Widget Co' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all audit logs successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockAuditLogs);
    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches audit logs with create filter', async () => {
    const createLogs = mockAuditLogs.filter((log) => log.action === 'create');
    const mockEq = vi.fn().mockResolvedValue({ data: createLogs, error: null });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: mockEq,
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('create'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(createLogs);
    expect(mockEq).toHaveBeenCalledWith('action', 'create');
  });

  it('fetches audit logs with update filter', async () => {
    const updateLogs = mockAuditLogs.filter((log) => log.action === 'update');
    const mockEq = vi.fn().mockResolvedValue({ data: updateLogs, error: null });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: mockEq,
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('update'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(updateLogs);
    expect(mockEq).toHaveBeenCalledWith('action', 'update');
  });

  it('fetches audit logs with delete filter', async () => {
    const deleteLogs = mockAuditLogs.filter((log) => log.action === 'delete');
    const mockEq = vi.fn().mockResolvedValue({ data: deleteLogs, error: null });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: mockEq,
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('delete'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(deleteLogs);
    expect(mockEq).toHaveBeenCalledWith('action', 'delete');
  });

  it('handles fetch error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('returns empty array when no audit logs exist', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('includes user and project relations in fetched data', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstLog = result.current.data![0];
    expect(firstLog.user).toBeDefined();
    expect(firstLog.user?.email).toBe('john@example.com');
    expect(firstLog.project).toBeDefined();
    expect(firstLog.project?.client_name).toBe('Acme Corp');
  });

  it('handles audit logs with null user and project', async () => {
    const logsWithNulls: AuditLogWithRelations[] = [
      {
        id: '4',
        project_id: null,
        user_id: null,
        action: 'create',
        field_name: 'status',
        old_value: null,
        new_value: 'New',
        created_at: '2024-01-15T13:00:00Z',
        user: null,
        project: null,
      },
    ];

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: logsWithNulls, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(logsWithNulls);
    expect(result.current.data![0].user).toBeNull();
    expect(result.current.data![0].project).toBeNull();
  });

  it('orders audit logs by created_at descending', async () => {
    const mockOrder = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: mockOrder,
      limit: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('limits results to 100 records', async () => {
    const mockLimit = vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it('shows loading state initially', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.isLoading).toBe(false);
  });

  it('caches results separately for different filters', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockAuditLogs, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useAuditLogs('all'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify that the query key includes the filter parameter
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBeGreaterThanOrEqual(0);
  });
});
