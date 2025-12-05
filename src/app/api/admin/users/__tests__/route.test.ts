import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as ReturnType<typeof createClient>);

    const response = await POST(createMockRequest({ email: 'new@test.com' }));
    expect(response.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'viewer' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await POST(createMockRequest({ email: 'new@test.com' }));
    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid email', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await POST(createMockRequest({ email: 'invalid' }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid email address');
  });

  it('returns 400 for invalid role', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await POST(createMockRequest({ email: 'new@test.com', role: 'superadmin' }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid role');
  });

  it('creates user with valid data', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-id', email: 'new@test.com' } },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createServiceClient>);

    const response = await POST(createMockRequest({ email: 'new@test.com', role: 'editor' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

describe('GET /api/admin/users', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    expect(response.status).toBe(401);
  });
});
