import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signOut, getCurrentUser } from '../auth';

// Mock Next.js functions
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

describe('auth.ts - signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sign out user, revalidate path, and redirect to login', async () => {
    // Arrange
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      auth: {
        signOut: mockSignOut,
      },
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await signOut();

    // Assert
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should handle signOut even if supabase returns error', async () => {
    // Arrange
    const mockSignOut = vi.fn().mockResolvedValue({
      error: { message: 'Sign out failed' }
    });
    const mockSupabase = {
      auth: {
        signOut: mockSignOut,
      },
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await signOut();

    // Assert - should still revalidate and redirect despite error
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should handle errors from createClient', async () => {
    // Arrange
    vi.mocked(createClient).mockRejectedValue(new Error('Connection failed'));

    // Act & Assert
    await expect(signOut()).rejects.toThrow('Connection failed');
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('auth.ts - getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user and profile when both exist', async () => {
    // Arrange
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockProfile = {
      id: 'user-123',
      full_name: 'Test User',
      role: 'admin',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result).toEqual({
      user: mockUser,
      profile: mockProfile,
    });
    expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('should return null user and profile when auth.getUser returns error', async () => {
    // Arrange
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
      from: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result).toEqual({
      user: null,
      profile: null,
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should return null user and profile when user is null', async () => {
    // Arrange
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result).toEqual({
      user: null,
      profile: null,
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should return user with null profile when profile fetch fails', async () => {
    // Arrange
    const mockUser = {
      id: 'user-456',
      email: 'noprofile@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Profile not found' },
            }),
          }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result).toEqual({
      user: mockUser,
      profile: null,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('should query profile with correct user id', async () => {
    // Arrange
    const userId = 'user-789';
    const mockUser = {
      id: userId,
      email: 'specific@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: userId, full_name: 'User' },
        error: null,
      }),
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act
    await getCurrentUser();

    // Assert
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(mockEq).toHaveBeenCalledWith('id', userId);
  });

  it('should handle createClient failure', async () => {
    // Arrange
    vi.mocked(createClient).mockRejectedValue(
      new Error('Failed to create Supabase client')
    );

    // Act & Assert
    await expect(getCurrentUser()).rejects.toThrow('Failed to create Supabase client');
  });

  it('should handle unexpected errors during profile fetch', async () => {
    // Arrange
    const mockUser = {
      id: 'user-error',
      email: 'error@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() => {
        throw new Error('Database connection lost');
      }),
    };

    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );

    // Act & Assert
    await expect(getCurrentUser()).rejects.toThrow('Database connection lost');
  });
});
