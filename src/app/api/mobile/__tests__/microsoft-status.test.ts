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

  it('returns correct shape when Microsoft is connected', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockConnection = {
      outlook_email: 'user@microsoft.com',
      token_expires_at: '2026-04-01T00:00:00Z',
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockConnection,
              error: null,
            }),
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/mobile/microsoft/status', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // Contract: connected response shape
    expect(body).toEqual({
      connected: true,
      email: 'user@microsoft.com',
      expires_at: '2026-04-01T00:00:00Z',
    });
  });

  it('returns correct shape when Microsoft is not connected', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    });

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
