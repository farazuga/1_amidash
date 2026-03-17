/**
 * Shared Test Helpers for API Route Tests
 *
 * Centralizes mock creation for NextRequest objects and Supabase clients
 * so individual API route tests don't rebuild these from scratch.
 */

import { vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { createClient, createServiceClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// 1. Request Builders
// ---------------------------------------------------------------------------

export interface MockRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  url?: string;
}

/**
 * Creates a NextRequest with a JSON body (defaults to POST).
 */
export function createMockRequest(
  body: Record<string, unknown>,
  options: MockRequestOptions = {}
): NextRequest {
  const {
    method = 'POST',
    headers = {},
    url = 'http://localhost:3000/api/test',
  } = options;

  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/**
 * Creates a GET NextRequest (no body).
 */
export function createMockGetRequest(
  url = 'http://localhost:3000/api/test',
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers,
  });
}

// ---------------------------------------------------------------------------
// 2. Supabase Chain Mock Builder
// ---------------------------------------------------------------------------

/**
 * Result shape for a single table's query.
 * Provide `data` and/or `error` — these will be returned at the terminal
 * of any chain (e.g. after `.single()`, `.order()`, `.limit()`, etc.).
 */
export interface TableResult {
  data?: unknown;
  error?: Record<string, unknown> | null;
}

export interface MockSupabaseConfig {
  /** User returned by auth.getUser(). null = unauthenticated. */
  user?: Record<string, unknown> | null;
  /** Error returned by auth.getUser(). */
  userError?: Record<string, unknown> | null;
  /**
   * Per-table query results.
   * Key = table name, value = the { data, error } to resolve with.
   *
   * You can also provide a function that receives the table name for
   * dynamic / multi-call scenarios (e.g. the same table queried twice
   * with different select fields).
   */
  tables?: Record<string, TableResult>;
  /**
   * Optional: provide a custom `from` implementation when you need
   * fine-grained control (e.g. different results based on select args).
   * When provided, the `tables` map is ignored.
   */
  fromOverride?: ReturnType<typeof vi.fn>;
}

/**
 * Builds a self-referencing chain object where every Supabase query
 * method (select, insert, update, delete, upsert, eq, neq, gt, gte,
 * lt, lte, like, ilike, is, in, order, limit, range, single,
 * maybeSingle) returns the same proxy, and the chain is also a
 * thenable that resolves with `{ data, error }`.
 *
 * This mirrors Supabase's fluent API so that any ordering of chained
 * calls works without needing to wire up each method individually.
 */
function buildChain(result: TableResult) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };

  // The chain object: every method returns itself, and it's thenable.
  const chain: Record<string, unknown> = {};

  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'containedBy',
    'not',
    'or',
    'filter',
    'match',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'csv',
    'returns',
  ];

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Make the chain thenable so `await supabase.from('t').select('*')` works.
  chain.then = (resolve: (value: unknown) => void) => {
    return Promise.resolve(resolved).then(resolve);
  };

  return chain;
}

/**
 * Creates a complete Supabase client mock suitable for API route tests.
 *
 * Supports:
 * - Auth: configurable user / userError
 * - Tables: configurable per-table results via `tables` map
 * - Chainable methods: select, insert, update, delete, eq, neq, order,
 *   limit, single, ilike, in, upsert, maybeSingle, and more
 *
 * Usage:
 * ```ts
 * const mock = createMockSupabaseForRoutes({
 *   user: { id: 'user-1' },
 *   tables: {
 *     profiles: { data: { role: 'admin' }, error: null },
 *     projects: { data: [{ id: 'p-1' }], error: null },
 *   },
 * });
 * vi.mocked(createClient).mockResolvedValue(mock);
 * ```
 */
export function createMockSupabaseForRoutes(
  config: MockSupabaseConfig = {}
): Awaited<ReturnType<typeof createClient>> {
  const {
    user = null,
    userError = null,
    tables = {},
    fromOverride,
  } = config;

  const fromFn =
    fromOverride ??
    vi.fn().mockImplementation((table: string) => {
      const tableResult = tables[table] ?? { data: null, error: null };
      return buildChain(tableResult);
    });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: userError,
      }),
    },
    from: fromFn,
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

// ---------------------------------------------------------------------------
// 3. Shorthand Factories
// ---------------------------------------------------------------------------

/**
 * Shorthand: unauthenticated Supabase client (user = null).
 */
export function createUnauthenticatedSupabase() {
  return createMockSupabaseForRoutes({ user: null });
}

/**
 * Shorthand: authenticated Supabase client with optional table results.
 */
export function createAuthenticatedSupabase(
  tables: Record<string, TableResult> = {},
  userId = 'test-user-id'
) {
  return createMockSupabaseForRoutes({
    user: { id: userId },
    tables,
  });
}

// ---------------------------------------------------------------------------
// 4. Service Client Helper
// ---------------------------------------------------------------------------

/**
 * Creates a mock service client (used for admin operations like
 * createUser, updateUserById, generateLink, etc.).
 *
 * The `overrides` object is spread into the mock, so you can provide
 * any shape your test needs.
 */
export function createMockServiceClient(
  overrides: Record<string, unknown> = {}
): Awaited<ReturnType<typeof createServiceClient>> {
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: null, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        generateLink: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    from: vi.fn().mockReturnValue(buildChain({ data: null, error: null })),
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof createServiceClient>>;
}
