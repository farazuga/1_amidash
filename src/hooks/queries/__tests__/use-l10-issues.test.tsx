import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useIssues,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  useReorderIssues,
  useSolveIssue,
  useIssueTodos,
} from '../use-l10-issues';

vi.mock('@/app/(dashboard)/l10/issues-actions', () => ({
  getIssues: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
  reorderIssues: vi.fn(),
  solveIssue: vi.fn(),
  getIssueTodos: vi.fn(),
}));

import {
  getIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  reorderIssues,
  solveIssue,
  getIssueTodos,
} from '@/app/(dashboard)/l10/issues-actions';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useIssues', () => {
  const mockIssues = [
    { id: 'issue-1', title: 'Broken build', status: 'open', priority_rank: 1 },
    { id: 'issue-2', title: 'Slow queries', status: 'open', priority_rank: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches issues successfully', async () => {
    vi.mocked(getIssues).mockResolvedValue({ success: true, data: mockIssues });

    const { result } = renderHook(() => useIssues('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockIssues);
    expect(getIssues).toHaveBeenCalledWith('team-1', undefined);
  });

  it('fetches issues with status filter', async () => {
    vi.mocked(getIssues).mockResolvedValue({ success: true, data: mockIssues });

    const { result } = renderHook(() => useIssues('team-1', 'open'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getIssues).toHaveBeenCalledWith('team-1', 'open');
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useIssues(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getIssues).not.toHaveBeenCalled();
  });

  it('returns empty array when no issues', async () => {
    vi.mocked(getIssues).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useIssues('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('handles error', async () => {
    vi.mocked(getIssues).mockResolvedValue({ success: false, error: 'Database error' });

    const { result } = renderHook(() => useIssues('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Database error');
  });

  it('shows loading state initially', async () => {
    vi.mocked(getIssues).mockResolvedValue({ success: true, data: mockIssues });

    const { result } = renderHook(() => useIssues('team-1'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useCreateIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates issue successfully', async () => {
    vi.mocked(createIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateIssue(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: 'New issue' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createIssue).toHaveBeenCalledWith({ teamId: 'team-1', title: 'New issue' });
  });

  it('creates issue with all fields', async () => {
    vi.mocked(createIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateIssue(), { wrapper: createWrapper() });

    result.current.mutate({
      teamId: 'team-1',
      title: 'New issue',
      description: 'Details here',
      sourceType: 'rock',
      sourceId: 'rock-1',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(createIssue).mockResolvedValue({ success: false, error: 'Validation failed' });

    const { result } = renderHook(() => useCreateIssue(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates issue successfully', async () => {
    vi.mocked(updateIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpdateIssue(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'issue-1', title: 'Updated' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(updateIssue).mockResolvedValue({ success: false, error: 'Not found' });

    const { result } = renderHook(() => useUpdateIssue(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'bad-id', title: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes issue successfully', async () => {
    vi.mocked(deleteIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteIssue(), { wrapper: createWrapper() });

    result.current.mutate('issue-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteIssue).toHaveBeenCalledWith('issue-1');
  });

  it('handles error', async () => {
    vi.mocked(deleteIssue).mockResolvedValue({ success: false, error: 'Cannot delete' });

    const { result } = renderHook(() => useDeleteIssue(), { wrapper: createWrapper() });

    result.current.mutate('issue-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useReorderIssues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders issues successfully', async () => {
    vi.mocked(reorderIssues).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useReorderIssues(), { wrapper: createWrapper() });

    const newOrder = [
      { id: 'issue-2', priority_rank: 1 },
      { id: 'issue-1', priority_rank: 2 },
    ];
    result.current.mutate(newOrder);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reorderIssues).toHaveBeenCalledWith(newOrder);
  });

  it('handles error', async () => {
    vi.mocked(reorderIssues).mockResolvedValue({ success: false, error: 'Reorder failed' });

    const { result } = renderHook(() => useReorderIssues(), { wrapper: createWrapper() });

    result.current.mutate([]);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSolveIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('solves issue successfully', async () => {
    vi.mocked(solveIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSolveIssue(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'issue-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(solveIssue).toHaveBeenCalledWith({ id: 'issue-1' });
  });

  it('solves issue with todo creation', async () => {
    vi.mocked(solveIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSolveIssue(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'issue-1', todoTitle: 'Follow up', todoOwnerId: 'user-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(solveIssue).mockResolvedValue({ success: false, error: 'Already solved' });

    const { result } = renderHook(() => useSolveIssue(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'issue-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useIssueTodos', () => {
  const mockTodos = [
    { id: 'todo-1', title: 'Follow up action' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches issue todos successfully', async () => {
    vi.mocked(getIssueTodos).mockResolvedValue({ success: true, data: mockTodos });

    const { result } = renderHook(() => useIssueTodos('issue-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTodos);
    expect(getIssueTodos).toHaveBeenCalledWith('issue-1');
  });

  it('does not fetch when issueId is null', async () => {
    const { result } = renderHook(() => useIssueTodos(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getIssueTodos).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getIssueTodos).mockResolvedValue({ success: false, error: 'Error' });

    const { result } = renderHook(() => useIssueTodos('issue-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
