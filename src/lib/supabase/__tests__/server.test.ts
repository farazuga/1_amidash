import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { getSupabaseEnv, getServiceRoleKey, createClient, createServiceClient } from '../server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

describe('getSupabaseEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns env vars when both are present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const result = getSupabaseEnv();

    expect(result.url).toBe('https://test.supabase.co');
    expect(result.anonKey).toBe('test-anon-key');
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    expect(() => getSupabaseEnv()).toThrow(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabaseEnv()).toThrow(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });

  it('throws when both env vars are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabaseEnv()).toThrow(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });

  it('throws when env vars are empty strings', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

    expect(() => getSupabaseEnv()).toThrow(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });
});

describe('getServiceRoleKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns service role key when present', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    const result = getServiceRoleKey();

    expect(result).toBe('test-service-key');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => getServiceRoleKey()).toThrow(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable'
    );
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is empty string', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';

    expect(() => getServiceRoleKey()).toThrow(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable'
    );
  });
});

describe('createClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates client with correct parameters', async () => {
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);

    const mockClient = { auth: { getUser: vi.fn() } };
    vi.mocked(createServerClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createServerClient>);

    const client = await createClient();

    expect(createServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
    expect(client).toBe(mockClient);
  });

  it('throws when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await expect(createClient()).rejects.toThrow(
      'Missing Supabase environment variables'
    );
  });

  it('cookie getAll returns cookies from store', async () => {
    const testCookies = [{ name: 'session', value: 'abc123' }];
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue(testCookies),
      set: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);
    vi.mocked(createServerClient).mockImplementation((url, key, options) => {
      // Call getAll to test it
      const result = options?.cookies?.getAll?.();
      expect(result).toEqual(testCookies);
      return {} as ReturnType<typeof createServerClient>;
    });

    await createClient();
  });

  it('cookie setAll handles errors gracefully', async () => {
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn().mockImplementation(() => {
        throw new Error('Server Component');
      }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);

    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    vi.mocked(createServerClient).mockImplementation((url, key, options) => {
      // Call setAll to test error handling
      options?.cookies?.setAll?.([{ name: 'test', value: 'value', options: {} }]);
      return {} as ReturnType<typeof createServerClient>;
    });

    await createClient();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Cookie setAll called from Server Component (expected)'
    );

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });
});

describe('createServiceClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates service client with service role key', async () => {
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);

    const mockClient = { auth: { admin: {} } };
    vi.mocked(createServerClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createServerClient>);

    const client = await createServiceClient();

    expect(createServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-service-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
    expect(client).toBe(mockClient);
  });

  it('throws when service role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);

    await expect(createServiceClient()).rejects.toThrow(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable'
    );
  });

  it('cookie setAll handles errors gracefully in service client', async () => {
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn().mockImplementation(() => {
        throw new Error('Server Component');
      }),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as ReturnType<typeof cookies>);

    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    vi.mocked(createServerClient).mockImplementation((url, key, options) => {
      options?.cookies?.setAll?.([{ name: 'test', value: 'value', options: {} }]);
      return {} as ReturnType<typeof createServerClient>;
    });

    await createServiceClient();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Cookie setAll called from Server Component (expected)'
    );

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });
});
