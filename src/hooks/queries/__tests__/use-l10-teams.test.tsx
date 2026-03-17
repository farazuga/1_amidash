import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useTeams,
  useTeam,
  useAllUsers,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateTeamMemberRole,
} from '../use-l10-teams';

// Mock the server actions
vi.mock('@/app/(dashboard)/l10/actions', () => ({
  getTeams: vi.fn(),
  getTeam: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
  updateTeamMemberRole: vi.fn(),
  getUsers: vi.fn(),
}));

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
} from '@/app/(dashboard)/l10/actions';

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

describe('useTeams', () => {
  const mockTeams = [
    { id: 'team-1', name: 'Engineering', description: 'Eng team' },
    { id: 'team-2', name: 'Sales', description: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches teams successfully', async () => {
    vi.mocked(getTeams).mockResolvedValue({ success: true, data: mockTeams });

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTeams);
  });

  it('returns empty array when no teams exist', async () => {
    vi.mocked(getTeams).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns empty array when data is undefined', async () => {
    vi.mocked(getTeams).mockResolvedValue({ success: true, data: undefined as never });

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('handles error from server action', async () => {
    vi.mocked(getTeams).mockResolvedValue({ success: false, error: 'Database error' });

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Database error');
  });

  it('shows loading state initially', async () => {
    vi.mocked(getTeams).mockResolvedValue({ success: true, data: mockTeams });

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useTeam', () => {
  const mockTeam = { id: 'team-1', name: 'Engineering', description: 'Eng team', members: [] };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a single team successfully', async () => {
    vi.mocked(getTeam).mockResolvedValue({ success: true, data: mockTeam });

    const { result } = renderHook(() => useTeam('team-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTeam);
    expect(getTeam).toHaveBeenCalledWith('team-1');
  });

  it('does not fetch when teamId is null', async () => {
    const { result } = renderHook(() => useTeam(null), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getTeam).not.toHaveBeenCalled();
  });

  it('handles error from server action', async () => {
    vi.mocked(getTeam).mockResolvedValue({ success: false, error: 'Team not found' });

    const { result } = renderHook(() => useTeam('bad-id'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Team not found');
  });
});

describe('useAllUsers', () => {
  const mockUsers = [
    { id: 'u1', full_name: 'Alice', email: 'alice@example.com' },
    { id: 'u2', full_name: 'Bob', email: 'bob@example.com' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches users successfully', async () => {
    vi.mocked(getUsers).mockResolvedValue({ success: true, data: mockUsers });

    const { result } = renderHook(() => useAllUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUsers);
  });

  it('handles error', async () => {
    vi.mocked(getUsers).mockResolvedValue({ success: false, error: 'Unauthorized' });

    const { result } = renderHook(() => useAllUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates team successfully', async () => {
    const newTeam = { id: 'team-new', name: 'New Team' };
    vi.mocked(createTeam).mockResolvedValue({ success: true, data: newTeam });

    const { result } = renderHook(() => useCreateTeam(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New Team' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createTeam).toHaveBeenCalledWith({ name: 'New Team' });
  });

  it('creates team with description', async () => {
    const newTeam = { id: 'team-new', name: 'New Team', description: 'A description' };
    vi.mocked(createTeam).mockResolvedValue({ success: true, data: newTeam });

    const { result } = renderHook(() => useCreateTeam(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New Team', description: 'A description' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles creation error', async () => {
    vi.mocked(createTeam).mockResolvedValue({ success: false, error: 'Name already taken' });

    const { result } = renderHook(() => useCreateTeam(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'Duplicate' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Name already taken');
  });
});

describe('useUpdateTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates team successfully', async () => {
    const updated = { id: 'team-1', name: 'Updated' };
    vi.mocked(updateTeam).mockResolvedValue({ success: true, data: updated });

    const { result } = renderHook(() => useUpdateTeam(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'team-1', name: 'Updated' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles update error', async () => {
    vi.mocked(updateTeam).mockResolvedValue({ success: false, error: 'Not found' });

    const { result } = renderHook(() => useUpdateTeam(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'bad-id', name: 'X' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes team successfully', async () => {
    vi.mocked(deleteTeam).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteTeam(), { wrapper: createWrapper() });

    result.current.mutate('team-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteTeam).toHaveBeenCalledWith('team-1');
  });

  it('handles delete error', async () => {
    vi.mocked(deleteTeam).mockResolvedValue({ success: false, error: 'Cannot delete' });

    const { result } = renderHook(() => useDeleteTeam(), { wrapper: createWrapper() });

    result.current.mutate('team-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAddTeamMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds member successfully', async () => {
    vi.mocked(addTeamMember).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAddTeamMember(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addTeamMember).toHaveBeenCalledWith({ teamId: 'team-1', userId: 'user-1' });
  });

  it('adds member with role', async () => {
    vi.mocked(addTeamMember).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAddTeamMember(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1', role: 'facilitator' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(addTeamMember).mockResolvedValue({ success: false, error: 'Already a member' });

    const { result } = renderHook(() => useAddTeamMember(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRemoveTeamMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes member successfully', async () => {
    vi.mocked(removeTeamMember).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useRemoveTeamMember(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles error', async () => {
    vi.mocked(removeTeamMember).mockResolvedValue({ success: false, error: 'Cannot remove last member' });

    const { result } = renderHook(() => useRemoveTeamMember(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateTeamMemberRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates member role successfully', async () => {
    vi.mocked(updateTeamMemberRole).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpdateTeamMemberRole(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1', role: 'facilitator' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateTeamMemberRole).toHaveBeenCalledWith({ teamId: 'team-1', userId: 'user-1', role: 'facilitator' });
  });

  it('handles error', async () => {
    vi.mocked(updateTeamMemberRole).mockResolvedValue({ success: false, error: 'Permission denied' });

    const { result } = renderHook(() => useUpdateTeamMemberRole(), { wrapper: createWrapper() });

    result.current.mutate({ teamId: 'team-1', userId: 'user-1', role: 'admin' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
