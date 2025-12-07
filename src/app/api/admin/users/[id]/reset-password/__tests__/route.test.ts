import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/users/user-123/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function createMockParams(userId: string) {
  return Promise.resolve({ id: userId });
}

describe('POST /api/admin/users/[id]/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-456' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'viewer' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 403 when user is an editor', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-456' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'editor' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>);

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 when password is missing', async () => {
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

    const request = createMockRequest({});
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be at least 8 characters');
  });

  it('returns 400 when password is null', async () => {
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

    const request = createMockRequest({ password: null });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be at least 8 characters');
  });

  it('returns 400 when password is empty string', async () => {
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

    const request = createMockRequest({ password: '' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be at least 8 characters');
  });

  it('returns 400 when password is less than 8 characters', async () => {
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

    const request = createMockRequest({ password: 'short' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be at least 8 characters');
  });

  it('returns 400 when password is exactly 7 characters', async () => {
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

    const request = createMockRequest({ password: '1234567' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be at least 8 characters');
  });

  it('successfully resets password with valid 8 character password', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });

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

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    const request = createMockRequest({ password: '12345678' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Password updated successfully');
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-123', { password: '12345678' });
  });

  it('successfully resets password with long password', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });

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

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    const longPassword = 'very-secure-password-with-special-chars-123!@#';
    const request = createMockRequest({ password: longPassword });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-123', { password: longPassword });
  });

  it('resets password for correct user ID from params', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });

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

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('target-user-789');

    await POST(request, { params });

    expect(mockUpdateUserById).toHaveBeenCalledWith('target-user-789', { password: 'newpassword123' });
  });

  it('returns 400 when password reset fails with Supabase error', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({
      error: { message: 'User not found' }
    });

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

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('nonexistent-user');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User not found');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error resetting password:',
      expect.objectContaining({ message: 'User not found' })
    );

    consoleSpy.mockRestore();
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Connection timeout'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
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

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = new NextRequest('http://localhost:3000/api/admin/users/user-123/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });
    const params = createMockParams('user-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');

    consoleSpy.mockRestore();
  });

  it('verifies admin role before processing request', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
      }),
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: mockGetUser,
      },
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as unknown as ReturnType<typeof createClient>);

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('user-123');

    await POST(request, { params });

    // Verify authentication and authorization flow
    expect(mockGetUser).toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalledWith('role');
    expect(mockUpdateUserById).toHaveBeenCalled();
  });

  it('handles different password formats correctly', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });

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

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    // Test with special characters
    const passwordsToTest = [
      'password123',
      'Password123!',
      'p@$$w0rd',
      '12345678',
      'abcdefgh',
      'ABCDEFGH',
      'Ab3$5678',
      'こんにちは123', // Unicode characters
    ];

    for (const password of passwordsToTest) {
      mockUpdateUserById.mockClear();

      const request = createMockRequest({ password });
      const params = createMockParams('user-123');

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdateUserById).toHaveBeenCalledWith('user-123', { password });
    }
  });

  it('admin can reset their own password', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });

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

    vi.mocked(createServiceClient).mockResolvedValue({
      auth: {
        admin: {
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    const request = createMockRequest({ password: 'newpassword123' });
    const params = createMockParams('admin-123'); // Same as the requesting admin

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdateUserById).toHaveBeenCalledWith('admin-123', { password: 'newpassword123' });
  });
});
