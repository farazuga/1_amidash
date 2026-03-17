import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useRocks,
  useCreateRock,
  useUpdateRock,
  useDeleteRock,
  useToggleRockStatus,
  useDropRockToIssue,
  useArchiveRock,
  useRockTodos,
} from '../use-l10-rocks';

vi.mock('@/app/(dashboard)/l10/rocks-actions', () => ({
  getRocks: vi.fn(),
  createRock: vi.fn(),
  updateRock: vi.fn(),
  deleteRock: vi.fn(),
  toggleRockStatus: vi.fn(),
  dropRockToIssue: vi.fn(),
  archiveRock: vi.fn(),
  getRockTodos: vi.fn(),
}));

import {
  getRocks,
  createRock,
  updateRock,
  deleteRock,
  toggleRockStatus,
  dropRockToIssue,
  archiveRock,
  getRockTodos,
} from '@/app/(dashboard)/l10/rocks-actions';

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

describe('useRocks', () => {
  const mockRocks = [
    { id: 'rock-1', title: 'Launch v2', status: 'on_track', quarter: '2026-Q1' },
    { id: 'rock-2', title: 'Hire PM', status: 'off_track', quarter: '2026-Q1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches rocks successfully', async () => {
    vi.mocked(getRocks).mockResolvedValue({ success: true, data: mockRocks });

    const { result } = renderHook(() => useRocks('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRocks);
    expect(getRocks).toHaveBeenCalledWith('team-1', undefined, false);
  });

  it('fetches rocks with quarter filter', async () => {
    vi.mocked(getRocks).mockResolvedValue({ success: true, data: mockRocks });

    const { result } = renderHook(() => useRocks('team-1', '2026-Q1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRocks).toHaveBeenCalledWith('team-1', '2026-Q1', false);
  });

  it('fetches rocks with showArchived flag', async () => {
    vi.mocked(getRocks).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useRocks('team-1', undefined, true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRocks).toHaveBeenCalledWith('team-1', undefined, true);
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useRocks(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getRocks).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getRocks).mockResolvedValue({ success: false, error: 'DB error' });

    const { result } = renderHook(() => useRocks('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateRock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates rock successfully', async () => {
    vi.mocked(createRock).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateRock(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: 'New Rock', quarter: '2026-Q1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createRock).toHaveBeenCalledWith({ teamId: 'team-1', title: 'New Rock', quarter: '2026-Q1' });
  });

  it('handles error', async () => {
    vi.mocked(createRock).mockResolvedValue({ success: false, error: 'Validation error' });

    const { result } = renderHook(() => useCreateRock(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: '', quarter: '2026-Q1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates rock successfully', async () => {
    vi.mocked(updateRock).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpdateRock(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'rock-1', title: 'Updated Rock' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(updateRock).mockResolvedValue({ success: false, error: 'Not found' });

    const { result } = renderHook(() => useUpdateRock(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'bad-id', title: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteRock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes rock successfully', async () => {
    vi.mocked(deleteRock).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteRock(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteRock).toHaveBeenCalledWith('rock-1');
  });

  it('handles error', async () => {
    vi.mocked(deleteRock).mockResolvedValue({ success: false, error: 'Cannot delete' });

    const { result } = renderHook(() => useDeleteRock(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useToggleRockStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles rock status successfully', async () => {
    vi.mocked(toggleRockStatus).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useToggleRockStatus(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toggleRockStatus).toHaveBeenCalledWith('rock-1');
  });

  it('handles error', async () => {
    vi.mocked(toggleRockStatus).mockResolvedValue({ success: false, error: 'Error' });

    const { result } = renderHook(() => useToggleRockStatus(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDropRockToIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops rock to issue successfully', async () => {
    vi.mocked(dropRockToIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDropRockToIssue(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(dropRockToIssue).toHaveBeenCalledWith('rock-1');
  });

  it('handles error', async () => {
    vi.mocked(dropRockToIssue).mockResolvedValue({ success: false, error: 'Already an issue' });

    const { result } = renderHook(() => useDropRockToIssue(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useArchiveRock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives rock successfully', async () => {
    vi.mocked(archiveRock).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useArchiveRock(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(archiveRock).toHaveBeenCalledWith('rock-1');
  });

  it('handles error', async () => {
    vi.mocked(archiveRock).mockResolvedValue({ success: false, error: 'Error' });

    const { result } = renderHook(() => useArchiveRock(), { wrapper: createWrapper() });

    result.current.mutate('rock-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRockTodos', () => {
  const mockTodos = [
    { id: 'todo-1', title: 'Sub-task 1' },
    { id: 'todo-2', title: 'Sub-task 2' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches rock todos successfully', async () => {
    vi.mocked(getRockTodos).mockResolvedValue({ success: true, data: mockTodos });

    const { result } = renderHook(() => useRockTodos('rock-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTodos);
    expect(getRockTodos).toHaveBeenCalledWith('rock-1');
  });

  it('does not fetch when rockId is null', async () => {
    const { result } = renderHook(() => useRockTodos(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getRockTodos).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getRockTodos).mockResolvedValue({ success: false, error: 'Error' });

    const { result } = renderHook(() => useRockTodos('rock-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
