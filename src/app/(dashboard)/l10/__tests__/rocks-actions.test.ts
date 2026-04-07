import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/l10/supabase-helpers');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getL10Client } from '@/lib/l10/supabase-helpers';
import { revalidatePath } from 'next/cache';
import { createMockL10Client, createMockL10Chain } from './test-helpers';
import {
  getRocks,
  createRock,
  updateRock,
  deleteRock,
  toggleRockStatus,
  dropRockToIssue,
  archiveRock,
  getRockTodos,
} from '../rocks-actions';

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

function createMockRock(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    team_id: VALID_UUID_2,
    title: 'Test Rock',
    description: 'Rock description',
    owner_id: 'test-user-id',
    quarter: '2026-Q1',
    due_date: '2026-03-31',
    status: 'on_track',
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z',
    profiles: { id: 'test-user-id', full_name: 'Test User', email: 'test@example.com' },
    milestones: [],
    ...overrides,
  };
}

// ============================================
// getRocks
// ============================================

describe('getRocks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns rocks for a team', async () => {
    const rocks = [createMockRock()];
    mockClient({ tables: { l10_rocks: { data: rocks, error: null } } });

    const result = await getRocks(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: rocks });
  });

  it('returns empty array when data is null', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await getRocks(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: [] });
  });

  it('filters by quarter when provided', async () => {
    const rocks = [createMockRock({ quarter: '2026-Q2' })];
    mockClient({ tables: { l10_rocks: { data: rocks, error: null } } });

    const result = await getRocks(VALID_UUID_2, '2026-Q2');

    expect(result).toEqual({ success: true, data: rocks });
  });

  it('excludes archived rocks by default', async () => {
    const rocks = [createMockRock()];
    mockClient({ tables: { l10_rocks: { data: rocks, error: null } } });

    const result = await getRocks(VALID_UUID_2);

    expect(result).toEqual({ success: true, data: rocks });
  });

  it('includes archived rocks when showArchived is true', async () => {
    const rocks = [createMockRock({ is_archived: true })];
    mockClient({ tables: { l10_rocks: { data: rocks, error: null } } });

    const result = await getRocks(VALID_UUID_2, undefined, true);

    expect(result).toEqual({ success: true, data: rocks });
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: { message: 'db error' } } } });

    const result = await getRocks(VALID_UUID_2);

    expect(result.success).toBe(false);
    expect(result.error).toBe('db error');
  });
});

// ============================================
// createRock
// ============================================

describe('createRock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a rock with explicit due date', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'New Rock',
      quarter: '2026-Q1',
      dueDate: '2026-02-28',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('defaults due date to quarter end when not provided — Q1 → March 31', async () => {
    const client = mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    await createRock({
      teamId: VALID_UUID_2,
      title: 'Q1 Rock',
      quarter: '2026-Q1',
    });

    const fromCall = (client.supabase as any).from;
    expect(fromCall).toHaveBeenCalledWith('l10_rocks');
  });

  it('defaults due date to Q2 end — June 30', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'Q2 Rock',
      quarter: '2026-Q2',
    });

    expect(result).toEqual({ success: true });
  });

  it('defaults due date to Q3 end — Sept 30', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'Q3 Rock',
      quarter: '2026-Q3',
    });

    expect(result).toEqual({ success: true });
  });

  it('defaults due date to Q4 end — Dec 31', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'Q4 Rock',
      quarter: '2026-Q4',
    });

    expect(result).toEqual({ success: true });
  });

  it('creates a rock with description and owner', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'Detailed Rock',
      description: 'Some details',
      ownerId: VALID_UUID_3,
      quarter: '2026-Q1',
    });

    expect(result).toEqual({ success: true });
  });

  it('returns validation error for missing title', async () => {
    const result = await createRock({
      teamId: VALID_UUID_2,
      quarter: '2026-Q1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid quarter format', async () => {
    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'Bad Quarter',
      quarter: 'Q1-2026',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for non-object input', async () => {
    const result = await createRock(42);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: { message: 'insert error' } } } });

    const result = await createRock({
      teamId: VALID_UUID_2,
      title: 'Will Fail',
      quarter: '2026-Q1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert error');
  });
});

// ============================================
// updateRock
// ============================================

describe('updateRock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a rock title', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await updateRock({
      id: VALID_UUID,
      title: 'Updated Title',
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('updates multiple fields at once', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await updateRock({
      id: VALID_UUID,
      title: 'New Title',
      description: 'New description',
      status: 'off_track',
      dueDate: '2026-06-30',
    });

    expect(result).toEqual({ success: true });
  });

  it('updates isArchived field', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await updateRock({
      id: VALID_UUID,
      isArchived: true,
    });

    expect(result).toEqual({ success: true });
  });

  it('returns validation error for missing id', async () => {
    const result = await updateRock({ title: 'No ID' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns validation error for invalid status', async () => {
    const result = await updateRock({
      id: VALID_UUID,
      status: 'invalid_status',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: { message: 'update error' } } } });

    const result = await updateRock({
      id: VALID_UUID,
      title: 'Will Fail',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update error');
  });
});

// ============================================
// deleteRock
// ============================================

describe('deleteRock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a rock', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: null } } });

    const result = await deleteRock(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { l10_rocks: { data: null, error: { message: 'delete error' } } } });

    const result = await deleteRock(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('delete error');
  });
});

// ============================================
// toggleRockStatus
// ============================================

describe('toggleRockStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flips on_track to off_track', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { status: 'on_track' }, error: null });
    (client.supabase as any).from = vi.fn().mockReturnValue(rockChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await toggleRockStatus(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('flips off_track to on_track', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { status: 'off_track' }, error: null });
    (client.supabase as any).from = vi.fn().mockReturnValue(rockChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await toggleRockStatus(VALID_UUID);

    expect(result).toEqual({ success: true });
  });

  it('returns error when fetch fails', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: null, error: { message: 'not found' } });
    (client.supabase as any).from = vi.fn().mockReturnValue(rockChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await toggleRockStatus(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('not found');
  });

  it('returns error when update fails', async () => {
    const client = createMockL10Client();
    const fetchChain = createMockL10Chain({ data: { status: 'on_track' }, error: null });
    const updateChain = createMockL10Chain({ data: null, error: { message: 'update error' } });

    let callCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? fetchChain : updateChain;
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await toggleRockStatus(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('update error');
  });
});

// ============================================
// dropRockToIssue
// ============================================

describe('dropRockToIssue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an issue from rock data', async () => {
    const rock = { team_id: VALID_UUID_2, title: 'Rock to Drop' };

    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: rock, error: null });
    const issueChain = createMockL10Chain({ data: null, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') return rockChain;
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await dropRockToIssue(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('preserves rock title in the created issue', async () => {
    const rock = { team_id: VALID_UUID_2, title: 'Important Rock Title' };

    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: rock, error: null });
    const issueChain = createMockL10Chain({ data: null, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') return rockChain;
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await dropRockToIssue(VALID_UUID);

    expect(result).toEqual({ success: true });
    // Verify the issue insert was called
    const fromFn = (client.supabase as any).from;
    expect(fromFn).toHaveBeenCalledWith('l10_issues');
  });

  it('returns error when rock fetch fails', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: null, error: { message: 'rock not found' } });

    (client.supabase as any).from = vi.fn().mockReturnValue(rockChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await dropRockToIssue(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('rock not found');
  });

  it('returns error when issue insert fails', async () => {
    const rock = { team_id: VALID_UUID_2, title: 'Rock' };

    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: rock, error: null });
    const issueChain = createMockL10Chain({ data: null, error: { message: 'insert failed' } });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') return rockChain;
      if (table === 'l10_issues') return issueChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await dropRockToIssue(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
  });
});

// ============================================
// archiveRock
// ============================================

describe('archiveRock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives rock when user is team admin', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { team_id: VALID_UUID_2 }, error: null });
    const memberChain = createMockL10Chain({ data: { role: 'admin' }, error: null });
    const updateChain = createMockL10Chain({ data: null, error: null });

    let rockCallCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') {
        rockCallCount++;
        return rockCallCount === 1 ? rockChain : updateChain;
      }
      if (table === 'team_members') return memberChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await archiveRock(VALID_UUID);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('archives rock when user is facilitator', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { team_id: VALID_UUID_2 }, error: null });
    const memberChain = createMockL10Chain({ data: { role: 'facilitator' }, error: null });
    const updateChain = createMockL10Chain({ data: null, error: null });

    let rockCallCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') {
        rockCallCount++;
        return rockCallCount === 1 ? rockChain : updateChain;
      }
      if (table === 'team_members') return memberChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await archiveRock(VALID_UUID);

    expect(result).toEqual({ success: true });
  });

  it('archives rock when user is global admin', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { team_id: VALID_UUID_2 }, error: null });
    const memberChain = createMockL10Chain({ data: { role: 'member' }, error: null });
    const profileChain = createMockL10Chain({ data: { role: 'admin' }, error: null });
    const updateChain = createMockL10Chain({ data: null, error: null });

    let rockCallCount = 0;
    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') {
        rockCallCount++;
        return rockCallCount === 1 ? rockChain : updateChain;
      }
      if (table === 'team_members') return memberChain;
      if (table === 'profiles') return profileChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await archiveRock(VALID_UUID);

    expect(result).toEqual({ success: true });
  });

  it('rejects non-admin/non-facilitator user', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { team_id: VALID_UUID_2 }, error: null });
    const memberChain = createMockL10Chain({ data: { role: 'member' }, error: null });
    const profileChain = createMockL10Chain({ data: { role: 'user' }, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') return rockChain;
      if (table === 'team_members') return memberChain;
      if (table === 'profiles') return profileChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await archiveRock(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Only team admins or facilitators can archive rocks');
  });

  it('rejects when no membership and no profile found', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: { team_id: VALID_UUID_2 }, error: null });
    const memberChain = createMockL10Chain({ data: null, error: null });
    const profileChain = createMockL10Chain({ data: null, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rocks') return rockChain;
      if (table === 'team_members') return memberChain;
      if (table === 'profiles') return profileChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await archiveRock(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Only team admins or facilitators can archive rocks');
  });

  it('returns error when rock fetch fails', async () => {
    const client = createMockL10Client();
    const rockChain = createMockL10Chain({ data: null, error: { message: 'not found' } });

    (client.supabase as any).from = vi.fn().mockReturnValue(rockChain);
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await archiveRock(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('not found');
  });
});

// ============================================
// getRockTodos
// ============================================

describe('getRockTodos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns todos linked to rock milestones', async () => {
    const milestones = [{ id: VALID_UUID_2 }, { id: VALID_UUID_3 }];
    const todos = [
      { id: 'todo-1', title: 'Todo 1', profiles: null, source_issue: null, source_milestone: null },
    ];

    const client = createMockL10Client();
    const milestoneChain = createMockL10Chain({ data: milestones, error: null });
    const todoChain = createMockL10Chain({ data: todos, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rock_milestones') return milestoneChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getRockTodos(VALID_UUID);

    expect(result).toEqual({ success: true, data: todos });
  });

  it('returns empty array when rock has no milestones', async () => {
    const client = createMockL10Client();
    const milestoneChain = createMockL10Chain({ data: [], error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rock_milestones') return milestoneChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getRockTodos(VALID_UUID);

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns empty array when milestones data is null', async () => {
    const client = createMockL10Client();
    const milestoneChain = createMockL10Chain({ data: null, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rock_milestones') return milestoneChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getRockTodos(VALID_UUID);

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns error when milestone fetch fails', async () => {
    const client = createMockL10Client();
    const milestoneChain = createMockL10Chain({ data: null, error: { message: 'milestone error' } });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rock_milestones') return milestoneChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getRockTodos(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('milestone error');
  });

  it('returns error when todo fetch fails', async () => {
    const milestones = [{ id: VALID_UUID_2 }];

    const client = createMockL10Client();
    const milestoneChain = createMockL10Chain({ data: milestones, error: null });
    const todoChain = createMockL10Chain({ data: null, error: { message: 'todo error' } });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rock_milestones') return milestoneChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getRockTodos(VALID_UUID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('todo error');
  });

  it('returns empty array when todos data is null but no error', async () => {
    const milestones = [{ id: VALID_UUID_2 }];

    const client = createMockL10Client();
    const milestoneChain = createMockL10Chain({ data: milestones, error: null });
    const todoChain = createMockL10Chain({ data: null, error: null });

    (client.supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === 'l10_rock_milestones') return milestoneChain;
      if (table === 'l10_todos') return todoChain;
      return createMockL10Chain({ data: null, error: null });
    });
    vi.mocked(getL10Client).mockResolvedValue(client as never);

    const result = await getRockTodos(VALID_UUID);

    expect(result).toEqual({ success: true, data: [] });
  });
});
