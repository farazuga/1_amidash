import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabaseEnv, getServiceRoleKey } from '../server';

describe('getSupabaseEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns env vars when present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const result = getSupabaseEnv();
    expect(result.url).toBe('https://test.supabase.co');
    expect(result.anonKey).toBe('test-anon-key');
  });

  it('throws when URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    expect(() => getSupabaseEnv()).toThrow('Missing Supabase environment variables');
  });

  it('throws when anon key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabaseEnv()).toThrow('Missing Supabase environment variables');
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

  it('returns key when present', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    expect(getServiceRoleKey()).toBe('test-service-key');
  });

  it('throws when key is missing', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getServiceRoleKey()).toThrow('Missing SUPABASE_SERVICE_ROLE_KEY');
  });
});
