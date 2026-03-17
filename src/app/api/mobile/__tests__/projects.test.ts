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
  })),
}));

// Mock service client
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Import the handler after mocks are set up
import { GET } from '../projects/route';

describe('GET /api/mobile/projects', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    const request = new Request('http://localhost/api/mobile/projects', {
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
      error: { message: 'Token expired' },
    });

    const request = new Request('http://localhost/api/mobile/projects', {
      method: 'GET',
      headers: { Authorization: 'Bearer expired-token' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
  });

  it('returns project list with correct shape (id, sales_order_number, client_name, status, phase)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockProjects = [
      { id: 'p-1', sales_order_number: 'S10001', client_name: 'Acme Corp', status: 'active', phase: 'active' },
      { id: 'p-2', sales_order_number: 'S10002', client_name: 'Beta Inc', status: 'on_hold', phase: 'on_hold' },
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
      expect(project).toHaveProperty('sales_order_number');
      expect(project).toHaveProperty('client_name');
      expect(project).toHaveProperty('status');
      expect(project).toHaveProperty('phase');
    }
  });

  it('returns empty array when no projects exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

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
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

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
