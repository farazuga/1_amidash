import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useTodos,
  useCreateTodo,
  useToggleTodo,
  useUpdateTodo,
  useDeleteTodo,
  useMyTodos,
  useOverdueTodoCount,
  useConvertTodoToIssue,
} from '../use-l10-todos';

vi.mock('@/app/(dashboard)/l10/todos-actions', () => ({
  getTodos: vi.fn(),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  toggleTodo: vi.fn(),
  deleteTodo: vi.fn(),
  getMyTodos: vi.fn(),
  getOverdueTodoCount: vi.fn(),
  convertTodoToIssue: vi.fn(),
}));

import {
  getTodos,
  createTodo,
  updateTodo,
  toggleTodo,
  deleteTodo,
  getMyTodos,
  getOverdueTodoCount,
  convertTodoToIssue,
} from '@/app/(dashboard)/l10/todos-actions';

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

describe('useTodos', () => {
  const mockTodos = [
    { id: 'todo-1', title: 'Fix bug', is_done: false, owner_id: 'user-1' },
    { id: 'todo-2', title: 'Write docs', is_done: true, owner_id: 'user-2' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches todos successfully', async () => {
    vi.mocked(getTodos).mockResolvedValue({ success: true, data: mockTodos });

    const { result } = renderHook(() => useTodos('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTodos);
    expect(getTodos).toHaveBeenCalledWith('team-1', false);
  });

  it('fetches todos with showDone flag', async () => {
    vi.mocked(getTodos).mockResolvedValue({ success: true, data: mockTodos });

    const { result } = renderHook(() => useTodos('team-1', true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTodos).toHaveBeenCalledWith('team-1', true);
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useTodos(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getTodos).not.toHaveBeenCalled();
  });

  it('returns empty array when no todos', async () => {
    vi.mocked(getTodos).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useTodos('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('handles error', async () => {
    vi.mocked(getTodos).mockResolvedValue({ success: false, error: 'Database error' });

    const { result } = renderHook(() => useTodos('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Database error');
  });
});

describe('useCreateTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates todo successfully', async () => {
    vi.mocked(createTodo).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateTodo(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: 'New task' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createTodo).toHaveBeenCalledWith({ teamId: 'team-1', title: 'New task' });
  });

  it('creates todo with all fields', async () => {
    vi.mocked(createTodo).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCreateTodo(), { wrapper: createWrapper() });

    result.current.mutate({
      teamId: 'team-1',
      title: 'New task',
      ownerId: 'user-1',
      dueDate: '2026-04-01',
      sourceMeetingId: 'meeting-1',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(createTodo).mockResolvedValue({ success: false, error: 'Validation failed' });

    const { result } = renderHook(() => useCreateTodo(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', title: '' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useToggleTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles todo successfully', async () => {
    vi.mocked(toggleTodo).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useToggleTodo(), { wrapper: createWrapper() });

    result.current.mutate('todo-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toggleTodo).toHaveBeenCalledWith('todo-1');
  });

  it('handles error', async () => {
    vi.mocked(toggleTodo).mockResolvedValue({ success: false, error: 'Not found' });

    const { result } = renderHook(() => useToggleTodo(), { wrapper: createWrapper() });

    result.current.mutate('bad-id');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates todo successfully', async () => {
    vi.mocked(updateTodo).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpdateTodo(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'todo-1', title: 'Updated title' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(updateTodo).mockResolvedValue({ success: false, error: 'Permission denied' });

    const { result } = renderHook(() => useUpdateTodo(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'todo-1', title: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes todo successfully', async () => {
    vi.mocked(deleteTodo).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteTodo(), { wrapper: createWrapper() });

    result.current.mutate('todo-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteTodo).toHaveBeenCalledWith('todo-1');
  });

  it('handles error', async () => {
    vi.mocked(deleteTodo).mockResolvedValue({ success: false, error: 'Cannot delete' });

    const { result } = renderHook(() => useDeleteTodo(), { wrapper: createWrapper() });

    result.current.mutate('todo-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMyTodos', () => {
  const mockMyTodos = [
    { id: 'todo-1', title: 'My task', is_done: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches my todos successfully', async () => {
    vi.mocked(getMyTodos).mockResolvedValue({ success: true, data: mockMyTodos });

    const { result } = renderHook(() => useMyTodos('user-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockMyTodos);
    expect(getMyTodos).toHaveBeenCalledWith('user-1', undefined);
  });

  it('fetches my todos filtered by team', async () => {
    vi.mocked(getMyTodos).mockResolvedValue({ success: true, data: mockMyTodos });

    const { result } = renderHook(() => useMyTodos('user-1', 'team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyTodos).toHaveBeenCalledWith('user-1', 'team-1');
  });

  it('does not fetch when userId is null', async () => {
    const { result } = renderHook(() => useMyTodos(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getMyTodos).not.toHaveBeenCalled();
  });

  it('handles error', async () => {
    vi.mocked(getMyTodos).mockResolvedValue({ success: false, error: 'Error' });

    const { result } = renderHook(() => useMyTodos('user-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useOverdueTodoCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches overdue count successfully', async () => {
    vi.mocked(getOverdueTodoCount).mockResolvedValue({ success: true, data: 5 });

    const { result } = renderHook(() => useOverdueTodoCount('user-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(5);
  });

  it('returns 0 when no overdue todos', async () => {
    vi.mocked(getOverdueTodoCount).mockResolvedValue({ success: true, data: 0 });

    const { result } = renderHook(() => useOverdueTodoCount('user-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
  });

  it('does not fetch when userId is null', async () => {
    const { result } = renderHook(() => useOverdueTodoCount(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('handles error', async () => {
    vi.mocked(getOverdueTodoCount).mockResolvedValue({ success: false, error: 'Error' });

    const { result } = renderHook(() => useOverdueTodoCount('user-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useConvertTodoToIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts todo to issue successfully', async () => {
    vi.mocked(convertTodoToIssue).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useConvertTodoToIssue(), { wrapper: createWrapper() });

    result.current.mutate('todo-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(convertTodoToIssue).toHaveBeenCalledWith({ todoId: 'todo-1' });
  });

  it('handles error', async () => {
    vi.mocked(convertTodoToIssue).mockResolvedValue({ success: false, error: 'Already an issue' });

    const { result } = renderHook(() => useConvertTodoToIssue(), { wrapper: createWrapper() });

    result.current.mutate('todo-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
