/**
 * Test Helpers for L10 Server Actions
 *
 * Creates mock Supabase clients matching the shape returned by `getL10Client()`.
 *
 * Usage:
 * ```ts
 * // In test file:
 * vi.mock('@/lib/l10/supabase-helpers');
 * import { getL10Client } from '@/lib/l10/supabase-helpers';
 *
 * beforeEach(() => {
 *   vi.mocked(getL10Client).mockResolvedValue(
 *     createMockL10Client({
 *       tables: {
 *         teams: { data: [{ id: '1', name: 'Team A' }], error: null },
 *         team_members: { data: [], error: null },
 *       },
 *     })
 *   );
 * });
 * ```
 */

import { vi } from 'vitest';

// ============================================
// Types
// ============================================

interface QueryResult {
  data: unknown;
  error: unknown;
}

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

interface MockL10ClientConfig {
  tables?: Record<string, QueryResult>;
  userId?: string;
  userEmail?: string;
}

// ============================================
// Chain Builder
// ============================================

/**
 * Creates a chainable mock that resolves to `result` at the end of any chain.
 * Supports: select, insert, update, delete, upsert, eq, neq, in, order, limit, range, single, maybeSingle.
 */
export function createMockL10Chain(result: QueryResult): MockChain {
  const chain: MockChain = {} as MockChain;

  // Terminal methods resolve to the result
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);

  // Chainable methods return the chain itself (and also act as a thenable resolving to result)
  const chainable = (fn: ReturnType<typeof vi.fn>) => {
    fn.mockImplementation(() => makeThenable(chain, result));
    return fn;
  };

  chain.select = chainable(vi.fn());
  chain.insert = chainable(vi.fn());
  chain.update = chainable(vi.fn());
  chain.delete = chainable(vi.fn());
  chain.upsert = chainable(vi.fn());
  chain.eq = chainable(vi.fn());
  chain.neq = chainable(vi.fn());
  chain.in = chainable(vi.fn());
  chain.order = chainable(vi.fn());
  chain.limit = chainable(vi.fn());
  chain.range = chainable(vi.fn());

  return chain;
}

/**
 * Makes an object thenable (awaitable) so that `await supabase.from('x').delete().eq('id', v)`
 * resolves to the result even without calling `.single()` or `.maybeSingle()`.
 */
function makeThenable(chain: MockChain, result: QueryResult) {
  return Object.assign(Object.create(chain), {
    then: (resolve: (v: QueryResult) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  });
}

// ============================================
// Client Builder
// ============================================

/**
 * Creates a mock matching the `{ supabase, user }` shape returned by `getL10Client()`.
 *
 * - `tables` maps table names to their query results. Any table not listed returns `{ data: null, error: null }`.
 * - `userId` / `userEmail` customize the mock user (defaults: `'test-user-id'` / `'test@example.com'`).
 */
export function createMockL10Client(config: MockL10ClientConfig = {}) {
  const {
    tables = {},
    userId = 'test-user-id',
    userEmail = 'test@example.com',
  } = config;

  const defaultResult: QueryResult = { data: null, error: null };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    const result = tables[table] ?? defaultResult;
    return createMockL10Chain(result);
  });

  return {
    supabase: { from: mockFrom } as unknown as Record<string, unknown>,
    user: { id: userId, email: userEmail },
  };
}

// ============================================
// Mock Data Factories
// ============================================

export function createMockTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-team-id',
    name: 'Test Team',
    description: null,
    created_by: 'test-user-id',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-meeting-id',
    team_id: 'test-team-id',
    title: 'L10 Meeting',
    status: 'in_progress',
    current_segment: 'segue',
    started_at: '2024-01-01T10:00:00Z',
    ended_at: null,
    facilitator_id: 'test-user-id',
    segment_started_at: '2024-01-01T10:00:00Z',
    average_rating: null,
    created_at: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

export function createMockTeamMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-member-id',
    team_id: 'test-team-id',
    user_id: 'test-user-id',
    role: 'member',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockRating(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-rating-id',
    meeting_id: 'test-meeting-id',
    user_id: 'test-user-id',
    rating: 8,
    explanation: null,
    created_at: '2024-01-01T11:00:00Z',
    ...overrides,
  };
}
