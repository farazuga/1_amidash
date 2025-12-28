import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Get Supabase environment variables with validation
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return { url, anonKey };
}

/**
 * Get Supabase service role key with validation
 */
export function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  return key;
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Expected when called from Server Components - cookies are read-only
          // Middleware handles session refresh, so this is safe to ignore
          if (process.env.NODE_ENV === 'development') {
            console.debug('Cookie setAll called from Server Component (expected)');
          }
        }
      },
    },
  });
}

export async function createServiceClient() {
  const cookieStore = await cookies();
  const { url } = getSupabaseEnv();
  const serviceKey = getServiceRoleKey();

  return createServerClient<Database>(url, serviceKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Expected when called from Server Components - cookies are read-only
          if (process.env.NODE_ENV === 'development') {
            console.debug('Cookie setAll called from Server Component (expected)');
          }
        }
      },
    },
  });
}
