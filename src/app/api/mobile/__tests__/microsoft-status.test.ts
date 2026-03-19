/**
 * Mobile Microsoft Status API Contract Tests
 *
 * Ensures GET /api/mobile/microsoft/status returns the correct shape
 * that the iOS app depends on. Changes here mean the iOS app
 * would break.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mobile auth
const mockAuthenticateMobileRequest = vi.fn();
vi.mock('@/lib/mobile/auth', () => ({
  authenticateMobileRequest: (...args: unknown[]) => mockAuthenticateMobileRequest(...args),
}));

// Import the handler after mocks are set up
import { GET } from '../microsoft/status/route';

describe('GET /api/mobile/microsoft/status', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue(
      Response.json({ error: 'Authentication required' }, { status: 401 })
    );

    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 with invalid/expired token', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue(
      Response.json({ error: 'Authentication required' }, { status: 401 })
    );

    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer bad-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns correct shape when Microsoft is connected', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    // Set Microsoft env vars
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

    // Contract: connected response shape (app-level auth: email/expires_at always null)
    expect(body).toEqual({
      connected: true,
      email: null,
      expires_at: null,
    });
  });

  it('returns correct shape when Microsoft is not connected', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });

    // Clear Microsoft env vars
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
  });
});
