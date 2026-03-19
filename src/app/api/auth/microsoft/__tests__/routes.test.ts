/**
 * Tests for Microsoft auth API routes:
 *   - sync (POST)
 *   - retry (POST)
 *   - errors (GET)
 *   - deprecated routes (GET 410)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/microsoft-graph/sync', () => ({
  fullSyncForUser: vi.fn(),
  retrySyncForAssignment: vi.fn(),
  getSyncErrors: vi.fn(),
}));
vi.mock('@/lib/microsoft-graph/auth');
vi.mock('@/lib/api/csrf', () => ({
  validateOrigin: vi.fn().mockReturnValue(null),
}));

import { createClient } from '@/lib/supabase/server';
import {
  fullSyncForUser,
  retrySyncForAssignment,
  getSyncErrors,
} from '@/lib/microsoft-graph/sync';
import { clearTokenCache, getAppAccessToken } from '@/lib/microsoft-graph/auth';
import {
  createMockRequest,
  createMockGetRequest,
  createAuthenticatedSupabase,
  createUnauthenticatedSupabase,
} from '../../../__tests__/test-helpers';

// Route handlers
import { POST as syncPOST } from '../sync/route';
import { POST as retryPOST } from '../retry/route';
import { GET as errorsGET } from '../errors/route';
import { GET as deprecatedMainGET } from '../route';
import { GET as deprecatedCallbackGET } from '../callback/route';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from('fake-signature').toString('base64url');
  return `${header}.${body}.${signature}`;
}

// ---------------------------------------------------------------------------
// 1. Sync Route
// ---------------------------------------------------------------------------

describe('POST /api/auth/microsoft/sync', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(createUnauthenticatedSupabase());

    const res = await syncPOST(new Request('http://localhost:3000/api/auth/microsoft/sync', { method: 'POST' }));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('clears token cache and returns sync results', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(fullSyncForUser).mockResolvedValue({
      synced: 3,
      failed: 1,
      errors: ['sync-err'],
    });

    const res = await syncPOST(new Request('http://localhost:3000/api/auth/microsoft/sync', { method: 'POST' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({
      success: true,
      synced: 3,
      failed: 1,
      errors: ['sync-err'],
    });

    expect(clearTokenCache).toHaveBeenCalledOnce();
    expect(fullSyncForUser).toHaveBeenCalledWith('test-user-id');
  });

  it('returns 500 when sync throws', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(fullSyncForUser).mockRejectedValue(new Error('Graph API down'));

    const res = await syncPOST(new Request('http://localhost:3000/api/auth/microsoft/sync', { method: 'POST' }));
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe('An internal error occurred. Please try again.');
  });

  it('handles non-Error throws', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(fullSyncForUser).mockRejectedValue('string error');

    const res = await syncPOST(new Request('http://localhost:3000/api/auth/microsoft/sync', { method: 'POST' }));
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe('An internal error occurred. Please try again.');
  });
});

// ---------------------------------------------------------------------------
// 2. Retry Route
// ---------------------------------------------------------------------------

describe('POST /api/auth/microsoft/retry', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(createUnauthenticatedSupabase());

    const req = createMockRequest({ assignmentId: VALID_UUID });
    const res = await retryPOST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing assignmentId', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());

    const req = createMockRequest({});
    const res = await retryPOST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid UUID format', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());

    const req = createMockRequest({ assignmentId: 'not-a-uuid' });
    const res = await retryPOST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('Invalid assignment ID format');
  });

  it('returns success on valid retry', async () => {
    vi.useFakeTimers();
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(retrySyncForAssignment).mockResolvedValue({ success: true });

    const uuid = '110e8400-e29b-41d4-a716-446655440000';
    const req = createMockRequest({ assignmentId: uuid });
    const res = await retryPOST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(retrySyncForAssignment).toHaveBeenCalledWith(uuid, 'test-user-id');
  });

  it('returns 429 when rate limited', async () => {
    vi.useFakeTimers();
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(retrySyncForAssignment).mockResolvedValue({ success: true });

    const uuid = '220e8400-e29b-41d4-a716-446655440000';

    // First call succeeds
    const req1 = createMockRequest({ assignmentId: uuid });
    const res1 = await retryPOST(req1);
    expect(res1.status).toBe(200);

    // Advance only 3 seconds — still within cooldown
    vi.advanceTimersByTime(3000);

    // Second call should be rate limited
    const req2 = createMockRequest({ assignmentId: uuid });
    const res2 = await retryPOST(req2);
    expect(res2.status).toBe(429);

    const json = await res2.json();
    expect(json.error).toMatch(/Please wait \d+ seconds/);
  });

  it('allows retry after cooldown expires', async () => {
    vi.useFakeTimers();
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(retrySyncForAssignment).mockResolvedValue({ success: true });

    const uuid = '330e8400-e29b-41d4-a716-446655440000';

    // First call
    const req1 = createMockRequest({ assignmentId: uuid });
    await retryPOST(req1);

    // Advance past cooldown
    vi.advanceTimersByTime(11000);

    // Should succeed
    const req2 = createMockRequest({ assignmentId: uuid });
    const res2 = await retryPOST(req2);
    expect(res2.status).toBe(200);
  });

  it('returns 400 when sync reports failure', async () => {
    vi.useFakeTimers();
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(retrySyncForAssignment).mockResolvedValue({
      success: false,
      error: 'Assignment not found',
    });

    // Use a different UUID to avoid cooldown from prior tests
    const differentUuid = '660e8400-e29b-41d4-a716-446655440000';
    const req = createMockRequest({ assignmentId: differentUuid });
    const res = await retryPOST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Assignment not found');
  });

  it('returns 500 when retry throws', async () => {
    vi.useFakeTimers();
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(retrySyncForAssignment).mockRejectedValue(new Error('boom'));

    const throwUuid = '770e8400-e29b-41d4-a716-446655440000';
    const req = createMockRequest({ assignmentId: throwUuid });
    const res = await retryPOST(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe('Retry failed');
  });
});

// ---------------------------------------------------------------------------
// 3. Debug Route
// ---------------------------------------------------------------------------
// 3. Errors Route
// ---------------------------------------------------------------------------

describe('GET /api/auth/microsoft/errors', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue(createUnauthenticatedSupabase());

    const res = await errorsGET();
    expect(res.status).toBe(401);
  });

  it('returns sync errors for authenticated user', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(getSyncErrors).mockResolvedValue({
      errors: [{ id: 'err-1', message: 'Something failed' }],
      count: 1,
    });

    const res = await errorsGET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.errors).toHaveLength(1);
    expect(json.count).toBe(1);
    expect(getSyncErrors).toHaveBeenCalledWith('test-user-id');
  });

  it('returns 500 when getSyncErrors throws', async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabase());
    vi.mocked(getSyncErrors).mockRejectedValue(new Error('DB error'));

    const res = await errorsGET();
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe('Failed to fetch sync errors');
  });
});

// ---------------------------------------------------------------------------
// 5. Deprecated Routes
// ---------------------------------------------------------------------------

describe('GET /api/auth/microsoft (deprecated)', () => {
  it('returns 410 Gone', async () => {
    const res = await deprecatedMainGET();
    expect(res.status).toBe(410);

    const json = await res.json();
    expect(json.error).toContain('no longer required');
  });
});

describe('GET /api/auth/microsoft/callback (deprecated)', () => {
  it('returns 410 Gone', async () => {
    const res = await deprecatedCallbackGET();
    expect(res.status).toBe(410);

    const json = await res.json();
    expect(json.error).toContain('no longer required');
  });
});
