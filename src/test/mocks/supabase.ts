import { vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

// Mock user
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
};

// Mock subscription
const mockSubscription = {
  unsubscribe: vi.fn(),
};

// Create a mock Supabase client
export function createMockSupabaseClient(overrides = {}) {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: mockSubscription },
      }),
    },
    from: mockFrom,
    ...overrides,
  };
}

// Helper to mock authenticated user
export function mockAuthenticatedUser(client: ReturnType<typeof createMockSupabaseClient>, user = mockUser) {
  client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  return user;
}

// Helper to mock profile
export function mockUserProfile(client: ReturnType<typeof createMockSupabaseClient>, profile: Record<string, unknown>) {
  const mockSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  client.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({ single: mockSingle }),
  });
  return profile;
}
