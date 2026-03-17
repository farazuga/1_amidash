/**
 * Mobile Microsoft Status API Contract Tests
 *
 * Ensures GET /api/mobile/microsoft/status returns the correct shape
 * that the iOS app depends on. Changes here mean the iOS app
 * would break.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock service client
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Import the handler after mocks are set up
import { GET } from '../microsoft/status/route';

describe('GET /api/mobile/microsoft/status', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 with invalid/expired token', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer bad-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns correct shape when Microsoft env vars are configured', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Route checks env vars, not DB - set them for this test
    const originalClientId = process.env.MICROSOFT_CLIENT_ID;
    const originalClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const originalTenantId = process.env.MICROSOFT_TENANT_ID;
    process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';
    process.env.MICROSOFT_TENANT_ID = 'test-tenant-id';

    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // Contract: connected response shape (app-level auth, no per-user email)
    expect(body).toEqual({
      connected: true,
      email: null,
      expires_at: null,
    });

    // Restore env vars
    process.env.MICROSOFT_CLIENT_ID = originalClientId;
    process.env.MICROSOFT_CLIENT_SECRET = originalClientSecret;
    process.env.MICROSOFT_TENANT_ID = originalTenantId;
  });

  it('returns correct shape when Microsoft env vars are missing', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Clear env vars to simulate unconfigured state
    const originalClientId = process.env.MICROSOFT_CLIENT_ID;
    const originalClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const originalTenantId = process.env.MICROSOFT_TENANT_ID;
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.MICROSOFT_TENANT_ID;

    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // Contract: disconnected response shape
    expect(body).toEqual({
      connected: false,
      email: null,
      expires_at: null,
    });

    // Restore env vars
    if (originalClientId) process.env.MICROSOFT_CLIENT_ID = originalClientId;
    if (originalClientSecret) process.env.MICROSOFT_CLIENT_SECRET = originalClientSecret;
    if (originalTenantId) process.env.MICROSOFT_TENANT_ID = originalTenantId;
  });
});
