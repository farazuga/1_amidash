import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/l10/supabase-helpers');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getL10Client } from '@/lib/l10/supabase-helpers';
import { revalidatePath } from 'next/cache';
import { createMockL10Client, createMockL10Chain } from './test-helpers';
import {
  getTodos,
  createTodo,
  updateTodo,
  toggleTodo,
  deleteTodo,
  getMyTodos,
  getOverdueTodoCount,
  convertTodoToIssue,
} from '../todos-actions';

// ============================================
// Helpers
// ============================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '770e8400-e29b-41d4-a716-446655440002';

function mockClient(config: Parameters<typeof createMockL10Client>[0] = {}) {
  const client = createMockL10Client(config);
  vi.mocked(getL10Client).mockResolvedValue(client as never);
  return client;
}

function createMockTodo(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    team_id: VALID_UUID_2,
    title: 'Test Todo',
    owner_id: 'test-user-id',
    due_date: '2026-04-01',
    is_done: false,
    created_at: '2026-01-01T00:00:00Z',
    profiles: { id: 'test-user-id', full_name: 'Test User', email: 'test@example.com' },
    source_issue: null,
    source_milestone: null,
    ...overrides,
  };
}

// ============================================
// getTodos
// ============================================

describe('getTodos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns todos for team excluding done by default', async () => {
    const todos = [createMockTodo()];
    mockClient({ tables: { l10_todos: { data: todos, error: null } } });

    const result = await getTodos(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: todos });
  });

  it('returns empty array when data is null', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await getTodos(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: [] });
  });

  it('includes done todos when showDone is true', async () => {
    const todos = [createMockTodo({ is_done: true })];
    mockClient({ tables: { l10_todos: { data: todos, error: null } } });

    const result = await getTodos(VALID_UUID_2, true);

    expect(result).toEqual({ success: true, data: todos });
  });

  it('calls eq with is_done false when showDone is false', async () => {
    const client = mockClient({ tables: { l10_todos: { data: [], error: null } } });

    await getTodos(VALID_UUID_2, false);

    // Verify from was called with l10_todos
    expect(client.supabase.from).toHaveBeenCalledWith('l10_todos');
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: { message: 'db error' } } } });

    const result = await getTodos(VALID_UUID_2);

    expect(result.success).toBe(false);
    expect(result.error).toBe('db error');
  });
});

// ============================================
// createTodo
// ============================================

describe('createTodo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a todo with all required fields', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await createTodo({
      teamId: VALID_UUID,
      title: 'New Todo',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('creates a todo with all optional fields', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await createTodo({
      teamId: VALID_UUID,
      title: 'New Todo',
      ownerId: VALID_UUID_2,
      dueDate: '2026-04-01',
      sourceMeetingId: VALID_UUID_3,
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('handles missing ownerId by setting null', async () => {
    const client = mockClient({ tables: { l10_todos: { data: null, error: null } } });

    await createTodo({ teamId: VALID_UUID, title: 'No owner' });

    // Verify insert was called (from -> insert chain)
    const chain = (client.supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(chain.insert).toHaveBeenCalled();
  });

  it('returns validation error for missing title', async () => {
    const result = await createTodo({ teamId: VALID_UUID });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for empty title', async () => {
    const result = await createTodo({ teamId: VALID_UUID, title: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid teamId', async () => {
    const result = await createTodo({ teamId: 'not-a-uuid', title: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid input type', async () => {
    const result = await createTodo(null);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: { message: 'insert failed' } } } });

    const result = await createTodo({ teamId: VALID_UUID, title: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
  });
});

// ============================================
// updateTodo
// ============================================

describe('updateTodo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a todo title', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await updateTodo({ id: VALID_UUID, title: 'Updated Title' });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('updates multiple fields at once', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await updateTodo({
      id: VALID_UUID,
      title: 'Updated',
      description: 'A description',
      ownerId: VALID_UUID_2,
      dueDate: '2026-05-01',
      isDone: true,
    });

    expect(result).toEqual({ success: true });
  });

  it('allows nullable fields', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await updateTodo({
      id: VALID_UUID,
      ownerId: null,
      dueDate: null,
      description: null,
    });

    expect(result).toEqual({ success: true });
  });

  it('returns validation error for missing id', async () => {
    const result = await updateTodo({ title: 'No ID' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid id', async () => {
    const result = await updateTodo({ id: 'bad-id', title: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid input', async () => {
    const result = await updateTodo('not an object');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: { message: 'update failed' } } } });

    const result = await updateTodo({ id: VALID_UUID, title: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update failed');
  });
});

// ============================================
// toggleTodo
// ============================================

describe('toggleTodo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggles a todo from not done to done', async () => {
    const todo = { is_done: false };
    // toggleTodo does two queries: select (single) then update
    // Both hit l10_todos, so the chain must handle both.
    // With the mock chain, single() returns the result, and update returns the result too.
    mockClient({ tables: { l10_todos: { data: todo, error: null } } });

    const result = await toggleTodo(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('toggles a todo from done to not done', async () => {
    const todo = { is_done: true };
    mockClient({ tables: { l10_todos: { data: todo, error: null } } });

    const result = await toggleTodo(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error when todo not found (fetch error)', async () => {
    mockClient({
      tables: { l10_todos: { data: null, error: { message: 'Row not found' } } },
    });

    const result = await toggleTodo(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Row not found');
  });

  it('returns error on database failure during update', async () => {
    // The mock chain returns the same result for both queries.
    // To simulate update failure, we use an error result (fetch will also fail first).
    mockClient({
      tables: { l10_todos: { data: null, error: { message: 'update error' } } },
    });

    const result = await toggleTodo(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('update error');
  });
});

// ============================================
// deleteTodo
// ============================================

describe('deleteTodo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a todo successfully', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await deleteTodo(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error on database failure', async () => {
    mockClient({
      tables: { l10_todos: { data: null, error: { message: 'delete failed' } } },
    });

    const result = await deleteTodo(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('delete failed');
  });

  it('returns error when todo not found', async () => {
    mockClient({
      tables: { l10_todos: { data: null, error: { message: 'Row not found' } } },
    });

    const result = await deleteTodo(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Row not found');
  });
});

// ============================================
// getMyTodos
// ============================================

describe('getMyTodos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns todos across all teams for user', async () => {
    const memberships = [
      { team_id: VALID_UUID, teams: { name: 'Team A' } },
      { team_id: VALID_UUID_2, teams: { name: 'Team B' } },
    ];
    const todos = [
      createMockTodo({ team_id: VALID_UUID }),
      createMockTodo({ id: VALID_UUID_3, team_id: VALID_UUID_2 }),
    ];

    // getMyTodos queries team_members first, then l10_todos
    // Both tables need results
    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: memberships, error: null });
    const todoChain = createMockL10Chain({ data: todos, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].team_name).toBe('Team A');
    expect(result.data![1].team_name).toBe('Team B');
  });

  it('returns empty array when user has no team memberships', async () => {
    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: [], error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id');

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns empty array when memberships data is null', async () => {
    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: null, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id');

    expect(result).toEqual({ success: true, data: [] });
  });

  it('filters by specific teamId when provided', async () => {
    const memberships = [
      { team_id: VALID_UUID, teams: { name: 'Team A' } },
      { team_id: VALID_UUID_2, teams: { name: 'Team B' } },
    ];
    const todos = [createMockTodo({ team_id: VALID_UUID })];

    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: memberships, error: null });
    const todoChain = createMockL10Chain({ data: todos, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id', VALID_UUID);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('returns error on membership query failure', async () => {
    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: null, error: { message: 'membership error' } });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('membership error');
  });

  it('returns error on todos query failure', async () => {
    const memberships = [{ team_id: VALID_UUID, teams: { name: 'Team A' } }];

    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: memberships, error: null });
    const todoChain = createMockL10Chain({ data: null, error: { message: 'todos error' } });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('todos error');
  });

  it('handles null team name gracefully', async () => {
    const memberships = [{ team_id: VALID_UUID, teams: null }];
    const todos = [createMockTodo({ team_id: VALID_UUID })];

    const client = createMockL10Client();
    const memberChain = createMockL10Chain({ data: memberships, error: null });
    const todoChain = createMockL10Chain({ data: todos, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'team_members') return memberChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getMyTodos('test-user-id');

    expect(result.success).toBe(true);
    expect(result.data![0].team_name).toBe('Unknown');
  });
});

// ============================================
// getOverdueTodoCount
// ============================================

describe('getOverdueTodoCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns count of overdue todos', async () => {
    // getOverdueTodoCount uses .lt() which isn't in the default chain.
    // We need a custom chain that supports lt.
    const chain = createMockL10Chain({ data: null, error: null });
    // Add lt to chain - it should be chainable like eq
    const ltResult = {
      ...chain,
      then: (resolve: (v: any) => void, reject?: (e: unknown) => void) =>
        Promise.resolve({ count: 3, data: null, error: null }).then(resolve, reject),
    };
    chain.eq = vi.fn().mockReturnValue({
      ...chain,
      eq: vi.fn().mockReturnValue({
        ...chain,
        lt: vi.fn().mockReturnValue(ltResult),
      }),
    });

    const client = createMockL10Client();
    (client.supabase as any).from = vi.fn().mockReturnValue(chain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getOverdueTodoCount('test-user-id');

    expect(result).toEqual({ success: true, data: 3 });
  });

  it('returns 0 when count is null', async () => {
    const chain = createMockL10Chain({ data: null, error: null });
    const ltResult = {
      ...chain,
      then: (resolve: (v: any) => void, reject?: (e: unknown) => void) =>
        Promise.resolve({ count: null, data: null, error: null }).then(resolve, reject),
    };
    chain.eq = vi.fn().mockReturnValue({
      ...chain,
      eq: vi.fn().mockReturnValue({
        ...chain,
        lt: vi.fn().mockReturnValue(ltResult),
      }),
    });

    const client = createMockL10Client();
    (client.supabase as any).from = vi.fn().mockReturnValue(chain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getOverdueTodoCount('test-user-id');

    expect(result).toEqual({ success: true, data: 0 });
  });

  it('returns error on database failure', async () => {
    const chain = createMockL10Chain({ data: null, error: null });
    const ltResult = {
      ...chain,
      then: (resolve: (v: any) => void, reject?: (e: unknown) => void) =>
        Promise.resolve({ count: null, data: null, error: { message: 'count error' } }).then(resolve, reject),
    };
    chain.eq = vi.fn().mockReturnValue({
      ...chain,
      eq: vi.fn().mockReturnValue({
        ...chain,
        lt: vi.fn().mockReturnValue(ltResult),
      }),
    });

    const client = createMockL10Client();
    (client.supabase as any).from = vi.fn().mockReturnValue(chain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getOverdueTodoCount('test-user-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('count error');
  });
});

// ============================================
// convertTodoToIssue
// ============================================

describe('convertTodoToIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts a todo to an issue', async () => {
    const todo = { team_id: VALID_UUID, title: 'Todo to convert' };
    const todoFull = { description: 'Some description' };

    const client = createMockL10Client();
    const todoSelectChain = createMockL10Chain({ data: todo, error: null });
    const todoDescChain = createMockL10Chain({ data: todoFull, error: null });
    const issueChain = createMockL10Chain({ data: null, error: null });

    let todoCallCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_todos') {
        todoCallCount++;
        // First call: select team_id, title; Second call: select description
        return todoCallCount === 1 ? todoSelectChain : todoDescChain;
      }
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await convertTodoToIssue({ todoId: VALID_UUID });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('converts a todo without description', async () => {
    const todo = { team_id: VALID_UUID, title: 'Todo' };

    const client = createMockL10Client();
    const todoSelectChain = createMockL10Chain({ data: todo, error: null });
    const todoDescChain = createMockL10Chain({ data: null, error: null });
    const issueChain = createMockL10Chain({ data: null, error: null });

    let todoCallCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_todos') {
        todoCallCount++;
        return todoCallCount === 1 ? todoSelectChain : todoDescChain;
      }
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await convertTodoToIssue({ todoId: VALID_UUID });

    expect(result).toEqual({ success: true });
  });

  it('returns validation error for missing todoId', async () => {
    const result = await convertTodoToIssue({});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid todoId', async () => {
    const result = await convertTodoToIssue({ todoId: 'not-a-uuid' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid input type', async () => {
    const result = await convertTodoToIssue(42);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when todo fetch fails', async () => {
    const client = createMockL10Client();
    const todoChain = createMockL10Chain({ data: null, error: { message: 'not found' } });

    (client.supabase as any).from = vi.fn().mockImplementation(() => todoChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await convertTodoToIssue({ todoId: VALID_UUID });

    expect(result.success).toBe(false);
    expect(result.error).toBe('not found');
  });

  it('returns error when issue insert fails', async () => {
    const todo = { team_id: VALID_UUID, title: 'Todo' };

    const client = createMockL10Client();
    const todoSelectChain = createMockL10Chain({ data: todo, error: null });
    const todoDescChain = createMockL10Chain({ data: { description: null }, error: null });
    const issueChain = createMockL10Chain({ data: null, error: { message: 'insert error' } });

    let todoCallCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_todos') {
        todoCallCount++;
        return todoCallCount === 1 ? todoSelectChain : todoDescChain;
      }
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await convertTodoToIssue({ todoId: VALID_UUID });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert error');
  });
});
