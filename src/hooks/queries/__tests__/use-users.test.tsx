import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useUsers,
  useCurrentUser,
  useUpdateUserRole,
  useUpdateUserSalesperson,
  useAddUser,
  useDeleteUser,
} from '../use-users';
import type { Profile } from '@/types';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';

// Mock fetch for API calls
global.fetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUsers', () => {
  const mockUsers: Profile[] = [
    {
      id: 'user-1',
      email: 'alice@example.com',
      full_name: 'Alice Johnson',
      role: 'admin',
      is_salesperson: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      email: 'bob@example.com',
      full_name: 'Bob Smith',
      role: 'member',
      is_salesperson: false,
      created_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'user-3',
      email: 'charlie@example.com',
      full_name: 'Charlie Brown',
      role: 'viewer',
      is_salesperson: false,
      created_at: '2024-01-03T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches users successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockUsers, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUsers);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result.current.isLoading).toBe(false);
  });

  it('orders users by email', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: mockUsers, error: null });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: mockOrder,
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockOrder).toHaveBeenCalledWith('email');
  });

  it('handles fetch error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('returns empty array when no users exist', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('shows loading state initially', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockUsers, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.isLoading).toBe(false);
  });
});

describe('useCurrentUser', () => {
  const mockCurrentUser: Profile = {
    id: 'current-user-id',
    email: 'current@example.com',
    full_name: 'Current User',
    role: 'admin',
    is_salesperson: true,
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches current user successfully', async () => {
    const mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'current-user-id' } },
      }),
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCurrentUser, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({
      auth: mockAuth,
      from: mockFrom,
    } as never);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockCurrentUser);
    expect(mockAuth.getUser).toHaveBeenCalled();
  });

  it('returns null when no user is authenticated', async () => {
    const mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
      }),
    };

    vi.mocked(createClient).mockReturnValue({
      auth: mockAuth,
    } as never);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('handles fetch error', async () => {
    const mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'current-user-id' } },
      }),
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('User not found'),
      }),
    });

    vi.mocked(createClient).mockReturnValue({
      auth: mockAuth,
      from: mockFrom,
    } as never);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates user role successfully', async () => {
    const updatedUser: Profile = {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Test User',
      role: 'admin',
      is_salesperson: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-1', role: 'admin' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(updatedUser);
  });

  it('updates user role from admin to member', async () => {
    const updatedUser: Profile = {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Test User',
      role: 'member',
      is_salesperson: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-1', role: 'member' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.role).toBe('member');
  });

  it('handles update error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Permission denied'),
      }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-1', role: 'admin' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('shows loading state during update', async () => {
    const updatedUser: Profile = {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Test User',
      role: 'admin',
      is_salesperson: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserRole(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);

    result.current.mutate({ id: 'user-1', role: 'admin' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useUpdateUserSalesperson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates user salesperson status successfully', async () => {
    const updatedUser: Profile = {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Test User',
      role: 'member',
      is_salesperson: true,
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserSalesperson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-1', is_salesperson: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.is_salesperson).toBe(true);
  });

  it('removes salesperson status from user', async () => {
    const updatedUser: Profile = {
      id: 'user-1',
      email: 'user@example.com',
      full_name: 'Test User',
      role: 'member',
      is_salesperson: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedUser, error: null }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserSalesperson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-1', is_salesperson: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.is_salesperson).toBe(false);
  });

  it('handles update error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Update failed'),
      }),
    });

    vi.mocked(createClient).mockReturnValue({ from: mockFrom } as never);

    const { result } = renderHook(() => useUpdateUserSalesperson(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-1', is_salesperson: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAddUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
  });

  it('adds user successfully', async () => {
    const newUserData = {
      email: 'new@example.com',
      full_name: 'New User',
      role: 'member' as const,
    };

    const createdUser = {
      id: 'new-user-id',
      ...newUserData,
      is_salesperson: false,
      created_at: '2024-01-10T00:00:00Z',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => createdUser,
    } as Response);

    // Need to mock Supabase client even though we're not using it directly
    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useAddUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(newUserData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserData),
    });
  });

  it('adds user with admin role', async () => {
    const newUserData = {
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'admin' as const,
    };

    const createdUser = {
      id: 'new-admin-id',
      ...newUserData,
      is_salesperson: false,
      created_at: '2024-01-10T00:00:00Z',
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => createdUser,
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useAddUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(newUserData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('handles API error with error message', async () => {
    const newUserData = {
      email: 'duplicate@example.com',
      full_name: 'Duplicate User',
      role: 'member' as const,
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'User already exists' }),
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useAddUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(newUserData);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('User already exists');
  });

  it('handles API error without error message', async () => {
    const newUserData = {
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'member' as const,
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useAddUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(newUserData);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to add user');
  });

  it('handles network error', async () => {
    const newUserData = {
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'member' as const,
    };

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useAddUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(newUserData);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockClear();
  });

  it('deletes user successfully', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-to-delete');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/users/user-to-delete', {
      method: 'DELETE',
    });
  });

  it('handles API error with error message', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Cannot delete last admin' }),
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('admin-user-id');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Cannot delete last admin');
  });

  it('handles API error without error message', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-id');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to delete user');
  });

  it('handles network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('user-id');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('shows loading state during deletion', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    vi.mocked(createClient).mockReturnValue({} as never);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);

    result.current.mutate('user-id');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
