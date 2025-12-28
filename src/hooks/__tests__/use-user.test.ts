import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUser } from '../use-user';
import { createMockSupabaseClient, mockUser, mockAuthenticatedUser } from '@/test/mocks/supabase';
import { createProfile } from '@/test/factories';

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';

describe('useUser hook', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.mocked(createClient).mockReturnValue(mockSupabase as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useUser());

    // Initial state is loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBe(null);
    expect(result.current.profile).toBe(null);
  });

  it('returns null user when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBe(null);
    expect(result.current.profile).toBe(null);
  });

  it('returns user and profile when authenticated', async () => {
    const user = mockAuthenticatedUser(mockSupabase, mockUser);
    const profile = createProfile({ id: user.id, role: 'admin' });

    // Mock profile fetch
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: profile, error: null }),
      }),
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.profile).toEqual(profile);
  });

  describe('role helpers', () => {
    it('isAdmin returns true for admin role', async () => {
      mockAuthenticatedUser(mockSupabase, mockUser);
      const profile = createProfile({ role: 'admin' });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isEditor).toBe(true);
      expect(result.current.isViewer).toBe(true);
    });

    it('isEditor returns true for editor role', async () => {
      mockAuthenticatedUser(mockSupabase, mockUser);
      const profile = createProfile({ role: 'editor' });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEditor).toBe(true);
      expect(result.current.isViewer).toBe(true);
    });

    it('isViewer returns true for viewer role', async () => {
      mockAuthenticatedUser(mockSupabase, mockUser);
      const profile = createProfile({ role: 'viewer' });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEditor).toBe(false);
      expect(result.current.isViewer).toBe(true);
    });

    it('all role helpers return false when no profile', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isEditor).toBe(false);
      expect(result.current.isViewer).toBe(false);
    });
  });

  describe('signOut', () => {
    it('clears user and profile on sign out', async () => {
      mockAuthenticatedUser(mockSupabase, mockUser);
      const profile = createProfile({ role: 'admin' });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        }),
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).not.toBe(null);

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBe(null);
      expect(result.current.profile).toBe(null);
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('auth state changes', () => {
    it('sets up auth state change listener', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { result } = renderHook(() => useUser());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('cleans up subscription on unmount', () => {
      const unsubscribeMock = vi.fn();
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } },
      });

      const { unmount } = renderHook(() => useUser());
      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
