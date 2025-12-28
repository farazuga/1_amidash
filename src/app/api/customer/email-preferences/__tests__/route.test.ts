import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '../route';
import { NextRequest } from 'next/server';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/customer/email-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/customer/email-preferences', () => {
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

  it('returns 401 when user has no email', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: null } }
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns default preference when no preference exists (PGRST116)', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toBe('user@example.com');
    expect(data.notifications_enabled).toBe(true); // Default value
  });

  it('returns existing preference when found', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { notifications_enabled: false },
              error: null
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toBe('user@example.com');
    expect(data.notifications_enabled).toBe(false);
  });

  it('returns 500 when database query fails with non-PGRST116 error', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST001', message: 'Database connection failed' }
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Database connection failed');
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Connection timeout'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('converts email to lowercase when querying', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { notifications_enabled: true },
          error: null
        }),
      }),
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'User@Example.COM' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as unknown as ReturnType<typeof createClient>);

    await GET();

    // Verify email was converted to lowercase
    const eqCall = mockSelect.mock.results[0].value.eq;
    expect(eqCall).toHaveBeenCalledWith('email', 'user@example.com');
  });
});

describe('PUT /api/customer/email-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: false });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when user has no email', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: null } }
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: false });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when notifications_enabled is not a boolean', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: 'true' });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('notifications_enabled must be a boolean');
  });

  it('returns 400 when notifications_enabled is missing', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({});

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('notifications_enabled must be a boolean');
  });

  it('returns 400 when notifications_enabled is null', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: null });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('notifications_enabled must be a boolean');
  });

  it('successfully updates preference to false', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: false });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notifications_enabled).toBe(false);
  });

  it('successfully updates preference to true', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: true });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notifications_enabled).toBe(true);
  });

  it('converts email to lowercase when upserting', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'User@Example.COM' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: true });

    await PUT(request);

    // Verify upsert was called with lowercase email
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        notifications_enabled: true,
      }),
      { onConflict: 'email' }
    );
  });

  it('includes updated_at timestamp when upserting', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: false });

    await PUT(request);

    // Verify updated_at was included
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        notifications_enabled: false,
        updated_at: expect.any(String),
      }),
      { onConflict: 'email' }
    );
  });

  it('uses onConflict option for upsert', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ notifications_enabled: true });

    await PUT(request);

    // Verify onConflict was set correctly
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Object),
      { onConflict: 'email' }
    );
  });

  it('returns 500 when upsert fails', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({
      error: { message: 'Database constraint violation' }
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as unknown as ReturnType<typeof createClient>);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = createMockRequest({ notifications_enabled: false });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Database constraint violation');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error updating email preference:',
      expect.objectContaining({ message: 'Database constraint violation' })
    );

    consoleSpy.mockRestore();
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Connection timeout'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = createMockRequest({ notifications_enabled: true });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Unexpected error:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('handles malformed JSON gracefully', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'user@example.com' } }
        }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = new NextRequest('http://localhost:3000/api/customer/email-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');

    consoleSpy.mockRestore();
  });
});
