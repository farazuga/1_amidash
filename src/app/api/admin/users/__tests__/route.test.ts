import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

// Mock Supabase
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
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      email: 'newuser@example.com',
      full_name: 'New User',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'viewer' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      email: 'newuser@example.com',
      full_name: 'New User',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 for invalid email', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      email: 'not-an-email',
      full_name: 'Test User',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid email address');
  });

  it('returns 400 for invalid role', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({
      email: 'newuser@example.com',
      full_name: 'Test User',
      role: 'superadmin', // Invalid role
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid role. Must be: admin, editor, or viewer');
  });

  it('accepts valid roles: admin', async () => {
    const mockServiceClient = {
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id', email: 'newuser@example.com' } },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(createServiceClient).mockResolvedValue(
      mockServiceClient as unknown as ReturnType<typeof createServiceClient>
    );

    const request = createMockRequest({
      email: 'newuser@example.com',
      full_name: 'New Admin',
      role: 'admin',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('accepts valid roles: editor', async () => {
    const mockServiceClient = {
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id', email: 'editor@example.com' } },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(createServiceClient).mockResolvedValue(
      mockServiceClient as unknown as ReturnType<typeof createServiceClient>
    );

    const request = createMockRequest({
      email: 'editor@example.com',
      full_name: 'New Editor',
      role: 'editor',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('accepts valid roles: viewer (default)', async () => {
    const mockServiceClient = {
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id', email: 'viewer@example.com' } },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(createServiceClient).mockResolvedValue(
      mockServiceClient as unknown as ReturnType<typeof createServiceClient>
    );

    const request = createMockRequest({
      email: 'viewer@example.com',
      full_name: 'New Viewer',
      // No role specified, should default to 'viewer'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'editor' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns users list when admin', async () => {
    const mockUsers = [
      { id: '1', email: 'user1@test.com', role: 'admin' },
      { id: '2', email: 'user2@test.com', role: 'viewer' },
    ];

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockImplementation((fields: string) => {
              if (fields === 'role') {
                return {
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
                  }),
                };
              }
              // For select('*')
              return {
                order: vi.fn().mockResolvedValue({ data: mockUsers, error: null }),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toEqual(mockUsers);
  });
});
