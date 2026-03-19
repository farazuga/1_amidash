/**
 * Mobile Projects API Contract Tests
 *
 * Ensures GET /api/mobile/projects returns the correct shape
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
    from: mockFrom,
  })),
}));

// Mock mobile auth
const mockAuthenticateMobileRequest = vi.fn();
vi.mock('@/lib/mobile/auth', () => ({
  authenticateMobileRequest: (...args: unknown[]) => mockAuthenticateMobileRequest(...args),
}));

// Import the handler after mocks are set up
import { GET } from '../projects/route';

describe('GET /api/mobile/projects', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue(
      Response.json({ error: 'Authentication required' }, { status: 401 })
    );

    const request = new Request('http://localhost/api/mobile/projects', {
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

    const request = new Request('http://localhost/api/mobile/projects', {
      method: 'GET',
      headers: { Authorization: 'Bearer expired-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns project list with correct shape (id, sales_order, client_name, status, phase)', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const mockProjects = [
      { id: 'p-1', sales_order: 'S10001', client_name: 'Acme Corp', status: 'active', phase: 'active' },
      { id: 'p-2', sales_order: 'S10002', client_name: 'Beta Inc', status: 'on_hold', phase: 'on_hold' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockProjects,
            error: null,
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/mobile/projects', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // Contract: response must have a 'projects' array
    expect(body).toHaveProperty('projects');
    expect(Array.isArray(body.projects)).toBe(true);

    // Contract: each project must have these fields
    for (const project of body.projects) {
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('sales_order');
      expect(project).toHaveProperty('client_name');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('phase');
    }
  });

  it('returns empty array when no projects exist', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/mobile/projects', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toEqual([]);
  });

  it('returns 500 when database query fails', async () => {
    mockAuthenticateMobileRequest.mockResolvedValue({ user: mockUser, profile: { role: 'admin' } });
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/mobile/projects', {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toHaveProperty('error');
  });
});
