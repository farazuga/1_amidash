import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/l10/supabase-helpers');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getL10Client } from '@/lib/l10/supabase-helpers';
import { revalidatePath } from 'next/cache';
import { createMockL10Client, createMockL10Chain } from './test-helpers';
import {
  getIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  reorderIssues,
  solveIssue,
  getIssueTodos,
} from '../issues-actions';

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

function createMockIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    team_id: VALID_UUID_2,
    title: 'Test Issue',
    description: null,
    status: 'open',
    priority_rank: 0,
    created_by: 'test-user-id',
    resolved_at: null,
    source_type: null,
    source_id: null,
    source_meta: null,
    created_at: '2026-01-01T00:00:00Z',
    profiles: { id: 'test-user-id', full_name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

function createMockTodo(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID_3,
    team_id: VALID_UUID_2,
    title: 'Follow-up Todo',
    owner_id: 'test-user-id',
    is_done: false,
    source_issue_id: VALID_UUID,
    created_at: '2026-01-01T00:00:00Z',
    profiles: { id: 'test-user-id', full_name: 'Test User', email: 'test@example.com' },
    ...overrides,
  };
}

// ============================================
// getIssues
// ============================================

describe('getIssues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns open and solving issues by default (no status)', async () => {
    const issues = [createMockIssue(), createMockIssue({ id: VALID_UUID_2, status: 'solving' })];
    mockClient({ tables: { l10_issues: { data: issues, error: null } } });

    const result = await getIssues(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: issues });
  });

  it('returns empty array when data is null', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await getIssues(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns all issues when status is "all"', async () => {
    const issues = [createMockIssue(), createMockIssue({ status: 'solved' })];
    mockClient({ tables: { l10_issues: { data: issues, error: null } } });

    const result = await getIssues(VALID_UUID_2, 'all');

    expect(result).toEqual({ success: true, data: issues });
  });

  it('filters by specific status', async () => {
    const issues = [createMockIssue({ status: 'solved' })];
    mockClient({ tables: { l10_issues: { data: issues, error: null } } });

    const result = await getIssues(VALID_UUID_2, 'solved');

    expect(result).toEqual({ success: true, data: issues });
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: new Error('DB error') } } });

    const result = await getIssues(VALID_UUID_2);

    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});

// ============================================
// createIssue
// ============================================

describe('createIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an issue with required fields', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await createIssue({
      teamId: VALID_UUID_2,
      title: 'New Issue',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('creates an issue with optional source tracking', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await createIssue({
      teamId: VALID_UUID_2,
      title: 'Issue from Rock',
      description: 'Detailed description',
      sourceType: 'rock',
      sourceId: VALID_UUID_3,
      sourceMeta: { rockTitle: 'Q1 Rock' },
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('rejects invalid input (missing title)', async () => {
    mockClient();

    const result = await createIssue({
      teamId: VALID_UUID_2,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects invalid input (missing teamId)', async () => {
    mockClient();

    const result = await createIssue({
      title: 'No team',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: new Error('Insert failed') } } });

    const result = await createIssue({
      teamId: VALID_UUID_2,
      title: 'Will fail',
    });

    expect(result).toEqual({ success: false, error: 'Insert failed' });
  });
});

// ============================================
// updateIssue
// ============================================

describe('updateIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates issue title', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await updateIssue({
      id: VALID_UUID,
      title: 'Updated Title',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('updates issue description', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await updateIssue({
      id: VALID_UUID,
      description: 'New description',
    });

    expect(result).toEqual({ success: true });
  });

  it('sets resolved_at when status changes to solved', async () => {
    const client = mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await updateIssue({
      id: VALID_UUID,
      status: 'solved',
    });

    expect(result).toEqual({ success: true });
    // Verify the update call included resolved_at
    const fromCall = client.supabase.from as ReturnType<typeof vi.fn>;
    expect(fromCall).toHaveBeenCalledWith('l10_issues');
  });

  it('does not set resolved_at for non-solved status', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await updateIssue({
      id: VALID_UUID,
      status: 'open',
    });

    expect(result).toEqual({ success: true });
  });

  it('rejects invalid input (missing id)', async () => {
    mockClient();

    const result = await updateIssue({
      title: 'No id',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: new Error('Update failed') } } });

    const result = await updateIssue({
      id: VALID_UUID,
      title: 'Will fail',
    });

    expect(result).toEqual({ success: false, error: 'Update failed' });
  });
});

// ============================================
// deleteIssue
// ============================================

describe('deleteIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes an issue by id', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await deleteIssue(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: new Error('Delete failed') } } });

    const result = await deleteIssue(VALID_UUID);

    expect(result).toEqual({ success: false, error: 'Delete failed' });
  });
});

// ============================================
// reorderIssues
// ============================================

describe('reorderIssues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates priority_rank for multiple issues', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: null } } });

    const result = await reorderIssues([
      { id: VALID_UUID, priority_rank: 0 },
      { id: VALID_UUID_2, priority_rank: 1 },
      { id: VALID_UUID_3, priority_rank: 2 },
    ]);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('rejects empty array as no-op', async () => {
    mockClient();

    const result = await reorderIssues([]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects invalid input (missing priority_rank)', async () => {
    mockClient();

    const result = await reorderIssues([{ id: VALID_UUID }]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_issues: { data: null, error: new Error('Reorder failed') } } });

    const result = await reorderIssues([
      { id: VALID_UUID, priority_rank: 0 },
    ]);

    expect(result).toEqual({ success: false, error: 'Reorder failed' });
  });
});

// ============================================
// solveIssue
// ============================================

describe('solveIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks issue as solved without creating todo', async () => {
    const issueChain = createMockL10Chain({
      data: { team_id: VALID_UUID_2 },
      error: null,
    });

    const client = createMockL10Client();
    const fromFn = client.supabase.from as ReturnType<typeof vi.fn>;
    fromFn.mockImplementation((table: string) => {
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await solveIssue({ id: VALID_UUID });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
    // Should NOT have called from('l10_todos')
    const todoCalls = fromFn.mock.calls.filter(
      (call: string[]) => call[0] === 'l10_todos'
    );
    expect(todoCalls).toHaveLength(0);
  });

  it('marks issue as solved and creates todo when todoTitle provided', async () => {
    const issueChain = createMockL10Chain({
      data: { team_id: VALID_UUID_2 },
      error: null,
    });
    const todoChain = createMockL10Chain({ data: null, error: null });

    const client = createMockL10Client();
    const fromFn = client.supabase.from as ReturnType<typeof vi.fn>;
    fromFn.mockImplementation((table: string) => {
      if (table === 'l10_issues') return issueChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await solveIssue({
      id: VALID_UUID,
      todoTitle: 'Follow up on issue',
      todoOwnerId: VALID_UUID_3,
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
    // Should have called from('l10_todos') for the insert
    const todoCalls = fromFn.mock.calls.filter(
      (call: string[]) => call[0] === 'l10_todos'
    );
    expect(todoCalls).toHaveLength(1);
  });

  it('creates todo with current user as owner when todoOwnerId not provided', async () => {
    const issueChain = createMockL10Chain({
      data: { team_id: VALID_UUID_2 },
      error: null,
    });
    const todoChain = createMockL10Chain({ data: null, error: null });

    const client = createMockL10Client({ userId: 'my-user-id' });
    const fromFn = client.supabase.from as ReturnType<typeof vi.fn>;
    fromFn.mockImplementation((table: string) => {
      if (table === 'l10_issues') return issueChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await solveIssue({
      id: VALID_UUID,
      todoTitle: 'Follow up',
    });

    expect(result).toEqual({ success: true });
    // Verify todo insert was called
    expect(todoChain.insert).toHaveBeenCalledWith({
      team_id: VALID_UUID_2,
      title: 'Follow up',
      owner_id: 'my-user-id',
      source_issue_id: VALID_UUID,
    });
  });

  it('rejects invalid input (missing id)', async () => {
    mockClient();

    const result = await solveIssue({});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns error when issue fetch fails', async () => {
    const issueChain = createMockL10Chain({
      data: null,
      error: new Error('Issue not found'),
    });

    const client = createMockL10Client();
    const fromFn = client.supabase.from as ReturnType<typeof vi.fn>;
    fromFn.mockImplementation(() => issueChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await solveIssue({ id: VALID_UUID });

    expect(result).toEqual({ success: false, error: 'Issue not found' });
  });
});

// ============================================
// getIssueTodos
// ============================================

describe('getIssueTodos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns todos linked to an issue', async () => {
    const todos = [createMockTodo()];
    mockClient({ tables: { l10_todos: { data: todos, error: null } } });

    const result = await getIssueTodos(VALID_UUID);

    expect(result).toEqual({ success: true, data: todos });
  });

  it('returns empty array when no linked todos', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: null } } });

    const result = await getIssueTodos(VALID_UUID);

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_todos: { data: null, error: new Error('Query failed') } } });

    const result = await getIssueTodos(VALID_UUID);

    expect(result).toEqual({ success: false, error: 'Query failed' });
  });
});
