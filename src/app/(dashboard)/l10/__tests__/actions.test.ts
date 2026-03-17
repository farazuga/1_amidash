import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/l10/supabase-helpers');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getL10Client } from '@/lib/l10/supabase-helpers';
import { revalidatePath } from 'next/cache';
import { createMockL10Client, createMockTeam } from './test-helpers';
import {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  getUsers,
} from '../actions';

// ============================================
// Helpers
// ============================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';

function mockClient(config: Parameters<typeof createMockL10Client>[0] = {}) {
  const client = createMockL10Client(config);
  vi.mocked(getL10Client).mockResolvedValue(client as never);
  return client;
}

// ============================================
// getTeams
// ============================================

describe('getTeams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns teams ordered by name', async () => {
    const teams = [createMockTeam({ name: 'Alpha' }), createMockTeam({ id: '2', name: 'Beta' })];
    mockClient({ tables: { teams: { data: teams, error: null } } });

    const result = await getTeams();

    expect(result).toEqual({ success: true, data: teams });
  });

  it('returns empty array when no teams exist', async () => {
    mockClient({ tables: { teams: { data: [], error: null } } });

    const result = await getTeams();

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns empty array when data is null', async () => {
    mockClient({ tables: { teams: { data: null, error: null } } });

    const result = await getTeams();

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { teams: { data: null, error: { message: 'connection refused' } } } });

    const result = await getTeams();

    expect(result.success).toBe(false);
    expect(result.error).toBe('connection refused');
  });
});

// ============================================
// getTeam
// ============================================

describe('getTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns team with members', async () => {
    const teamWithMembers = {
      ...createMockTeam(),
      team_members: [
        { id: 'm1', team_id: 'test-team-id', user_id: 'u1', role: 'admin', created_at: '2024-01-01T00:00:00Z', profiles: { id: 'u1', full_name: 'Alice', email: 'alice@test.com' } },
      ],
    };
    mockClient({ tables: { teams: { data: teamWithMembers, error: null } } });

    const result = await getTeam('test-team-id');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(teamWithMembers);
  });

  it('returns error when team not found', async () => {
    mockClient({
      tables: { teams: { data: null, error: { message: 'Row not found', code: 'PGRST116' } } },
    });

    const result = await getTeam('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Row not found');
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { teams: { data: null, error: { message: 'DB error' } } } });

    const result = await getTeam('any-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
  });
});

// ============================================
// createTeam
// ============================================

describe('createTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates team and adds creator as admin member', async () => {
    const team = createMockTeam({ id: VALID_UUID });
    mockClient({
      tables: {
        teams: { data: team, error: null },
        team_members: { data: null, error: null },
      },
    });

    const result = await createTeam({ name: 'New Team' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(team);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('creates team with description', async () => {
    const team = createMockTeam({ description: 'A cool team' });
    mockClient({
      tables: {
        teams: { data: team, error: null },
        team_members: { data: null, error: null },
      },
    });

    const result = await createTeam({ name: 'New Team', description: 'A cool team' });

    expect(result.success).toBe(true);
  });

  it('returns validation error for missing name', async () => {
    const result = await createTeam({});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(getL10Client).not.toHaveBeenCalled();
  });

  it('returns validation error for empty name', async () => {
    const result = await createTeam({ name: '' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('returns validation error for name too long', async () => {
    const result = await createTeam({ name: 'x'.repeat(101) });

    expect(result.success).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('returns validation error for description too long', async () => {
    const result = await createTeam({ name: 'OK', description: 'x'.repeat(501) });

    expect(result.success).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('returns error on team insert failure', async () => {
    mockClient({
      tables: {
        teams: { data: null, error: { message: 'insert failed' } },
        team_members: { data: null, error: null },
      },
    });

    const result = await createTeam({ name: 'New Team' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns error on member insert failure', async () => {
    // teams succeeds but team_members fails
    // Since both tables share the mock, we need teams to succeed (for the insert().select().single() path)
    // and team_members to fail. With the current mock helper, both resolve to the same result per table.
    // The createTeam first inserts into teams (success), then into team_members (fail).
    // We need teams to return data and team_members to return error.
    mockClient({
      tables: {
        teams: { data: createMockTeam(), error: null },
        team_members: { data: null, error: { message: 'member insert failed' } },
      },
    });

    const result = await createTeam({ name: 'New Team' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('member insert failed');
  });
});

// ============================================
// updateTeam
// ============================================

describe('updateTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates team fields successfully', async () => {
    const updated = createMockTeam({ id: VALID_UUID, name: 'Updated' });
    mockClient({ tables: { teams: { data: updated, error: null } } });

    const result = await updateTeam({ id: VALID_UUID, name: 'Updated' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(updated);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns validation error for invalid uuid', async () => {
    const result = await updateTeam({ id: 'not-a-uuid', name: 'Test' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(getL10Client).not.toHaveBeenCalled();
  });

  it('returns validation error for missing id', async () => {
    const result = await updateTeam({ name: 'Test' });

    expect(result.success).toBe(false);
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { teams: { data: null, error: { message: 'update failed' } } } });

    const result = await updateTeam({ id: VALID_UUID, name: 'Fail' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update failed');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ============================================
// deleteTeam
// ============================================

describe('deleteTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes team successfully', async () => {
    mockClient({ tables: { teams: { data: null, error: null } } });

    const result = await deleteTeam('test-team-id');

    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { teams: { data: null, error: { message: 'delete failed' } } } });

    const result = await deleteTeam('test-team-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('delete failed');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ============================================
// addTeamMember
// ============================================

describe('addTeamMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds member successfully', async () => {
    mockClient({ tables: { team_members: { data: null, error: null } } });

    const result = await addTeamMember({ teamId: VALID_UUID, userId: VALID_UUID_2, role: 'member' });

    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('adds member with default role when role omitted', async () => {
    mockClient({ tables: { team_members: { data: null, error: null } } });

    const result = await addTeamMember({ teamId: VALID_UUID, userId: VALID_UUID_2 });

    expect(result.success).toBe(true);
  });

  it('returns friendly error on duplicate member (23505)', async () => {
    mockClient({
      tables: { team_members: { data: null, error: { code: '23505', message: 'unique violation' } } },
    });

    const result = await addTeamMember({ teamId: VALID_UUID, userId: VALID_UUID_2 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('User is already a team member');
  });

  it('returns raw error for non-duplicate DB errors', async () => {
    mockClient({
      tables: { team_members: { data: null, error: { code: '42501', message: 'permission denied' } } },
    });

    const result = await addTeamMember({ teamId: VALID_UUID, userId: VALID_UUID_2 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('permission denied');
  });

  it('returns validation error for invalid teamId', async () => {
    const result = await addTeamMember({ teamId: 'bad', userId: VALID_UUID_2 });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(getL10Client).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid userId', async () => {
    const result = await addTeamMember({ teamId: VALID_UUID, userId: 'bad' });

    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid role', async () => {
    const result = await addTeamMember({ teamId: VALID_UUID, userId: VALID_UUID_2, role: 'superadmin' });

    expect(result.success).toBe(false);
  });
});

// ============================================
// removeTeamMember
// ============================================

describe('removeTeamMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes member successfully', async () => {
    mockClient({ tables: { team_members: { data: null, error: null } } });

    const result = await removeTeamMember({ teamId: 'team-1', userId: 'user-1' });

    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { team_members: { data: null, error: { message: 'delete failed' } } } });

    const result = await removeTeamMember({ teamId: 'team-1', userId: 'user-1' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('delete failed');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ============================================
// updateTeamMemberRole
// ============================================

describe('updateTeamMemberRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates role successfully', async () => {
    mockClient({ tables: { team_members: { data: null, error: null } } });

    const result = await updateTeamMemberRole({ teamId: VALID_UUID, userId: VALID_UUID_2, role: 'admin' });

    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/l10');
  });

  it('returns validation error for missing role', async () => {
    const result = await updateTeamMemberRole({ teamId: VALID_UUID, userId: VALID_UUID_2 });

    expect(result.success).toBe(false);
    expect(getL10Client).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid role', async () => {
    const result = await updateTeamMemberRole({ teamId: VALID_UUID, userId: VALID_UUID_2, role: 'owner' });

    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid UUIDs', async () => {
    const result = await updateTeamMemberRole({ teamId: 'bad', userId: 'bad', role: 'admin' });

    expect(result.success).toBe(false);
    expect(getL10Client).not.toHaveBeenCalled();
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { team_members: { data: null, error: { message: 'update failed' } } } });

    const result = await updateTeamMemberRole({ teamId: VALID_UUID, userId: VALID_UUID_2, role: 'facilitator' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update failed');
  });
});

// ============================================
// getUsers
// ============================================

describe('getUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all profiles', async () => {
    const users = [
      { id: '1', full_name: 'Alice', email: 'alice@test.com' },
      { id: '2', full_name: 'Bob', email: 'bob@test.com' },
    ];
    mockClient({ tables: { profiles: { data: users, error: null } } });

    const result = await getUsers();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(users);
  });

  it('returns empty array when no users exist', async () => {
    mockClient({ tables: { profiles: { data: null, error: null } } });

    const result = await getUsers();

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns error on database failure', async () => {
    mockClient({ tables: { profiles: { data: null, error: { message: 'profiles error' } } } });

    const result = await getUsers();

    expect(result.success).toBe(false);
    expect(result.error).toBe('profiles error');
  });
});
