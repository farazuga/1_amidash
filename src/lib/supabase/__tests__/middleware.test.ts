import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateSession } from '../middleware';

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';

describe('updateSession middleware', () => {
  let mockGetUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser = vi.fn();

    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: mockGetUser,
      },
    } as never);
  });

  function createMockRequest(pathname: string) {
    const baseUrl = 'http://localhost:3000';
    const url = new URL(pathname, baseUrl);

    // Create a mock NextURL with clone method
    const nextUrl = Object.assign(url, {
      clone: () => new URL(url.href),
    });

    return {
      nextUrl,
      cookies: {
        getAll: vi.fn().mockReturnValue([]),
        set: vi.fn(),
      },
    };
  }

  describe('protected routes', () => {
    it('redirects unauthenticated users from / to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toContain('/login');
    });

    it('redirects unauthenticated users from /projects to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/projects');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toContain('/login');
    });

    it('redirects unauthenticated users from /projects/new to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/projects/new');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toContain('/login');
    });

    it('redirects unauthenticated users from /admin routes to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/admin/users');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toContain('/login');
    });

    it('allows authenticated users to access protected routes', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      const mockRequest = createMockRequest('/projects');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toBeNull();
    });
  });

  describe('login page', () => {
    it('redirects authenticated users from /login to /', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      const mockRequest = createMockRequest('/login');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toContain('/');
    });

    it('allows unauthenticated users to access /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/login');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toBeNull();
    });
  });

  describe('public routes', () => {
    it('allows unauthenticated users to access /status routes', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/status/token123');

      const response = await updateSession(mockRequest as never);

      expect(response.headers.get('location')).toBeNull();
    });
  });

  describe('cookie handling', () => {
    it('creates client with cookie handlers', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const mockRequest = createMockRequest('/status/public');

      await updateSession(mockRequest as never);

      // Verify createServerClient was called with cookies configuration
      expect(createServerClient).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(createServerClient).mock.calls[0];
      expect(callArgs[2]).toHaveProperty('cookies');
      expect(callArgs[2].cookies).toHaveProperty('getAll');
      expect(callArgs[2].cookies).toHaveProperty('setAll');
      expect(typeof callArgs[2].cookies.getAll).toBe('function');
      expect(typeof callArgs[2].cookies.setAll).toBe('function');
    });
  });
});
