/**
 * Example Test Using Test Helpers
 *
 * This file demonstrates how to use the test helpers to write cleaner,
 * more maintainable tests for server actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentUser } from '../auth';
import {
  createMockSupabaseAuth,
  createMockUser,
  createMockProfile,
} from './test-helpers';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('Example: Using Test Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use test helpers to create a successful auth mock', async () => {
    // Arrange - Using test helpers makes this much cleaner
    const mockUser = createMockUser({
      id: 'custom-user-id',
      email: 'custom@example.com',
    });

    const mockProfile = createMockProfile({
      id: 'custom-user-id',
      role: 'editor',
    });

    const mockSupabase = createMockSupabaseAuth({
      user: mockUser,
      profile: mockProfile,
    });

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result.user).toEqual(mockUser);
    expect(result.profile).toEqual(mockProfile);
  });

  it('should use test helpers to create an error scenario', async () => {
    // Arrange - Simulating an auth error is now simple
    const mockSupabase = createMockSupabaseAuth({
      user: null,
      error: { message: 'Authentication failed' },
    });

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result.user).toBeNull();
    expect(result.profile).toBeNull();
  });

  it('should demonstrate profile error handling with helpers', async () => {
    // Arrange - User exists but profile fetch fails
    const mockUser = createMockUser();
    const mockSupabase = createMockSupabaseAuth({
      user: mockUser,
      profile: null,
      profileError: { message: 'Profile not found' },
    });

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result.user).toEqual(mockUser);
    expect(result.profile).toBeNull();
  });

  it('should show how to override default mock values', async () => {
    // Arrange - Customize only what you need
    const adminUser = createMockUser({
      email: 'admin@company.com',
    });

    const adminProfile = createMockProfile({
      role: 'admin',
      full_name: 'Super Admin',
    });

    const mockSupabase = createMockSupabaseAuth({
      user: adminUser,
      profile: adminProfile,
    });

    vi.mocked(createClient).mockResolvedValue(mockSupabase);

    // Act
    const result = await getCurrentUser();

    // Assert
    expect(result.user?.email).toBe('admin@company.com');
    expect(result.profile?.role).toBe('admin');
    expect(result.profile?.full_name).toBe('Super Admin');
  });
});
