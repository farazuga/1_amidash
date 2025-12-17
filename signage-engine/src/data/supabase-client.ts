import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create a Supabase client for the signage engine.
 * Uses service role key for unrestricted read access.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  logger.info('Supabase client initialized');
  return supabaseClient;
}

/**
 * Test the Supabase connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('statuses').select('id').limit(1);

    if (error) {
      logger.error({ error }, 'Supabase connection test failed');
      return false;
    }

    logger.info('Supabase connection test successful');
    return true;
  } catch (error) {
    logger.error({ error }, 'Supabase connection test threw an exception');
    return false;
  }
}

/**
 * Close the Supabase client (for cleanup)
 */
export function closeSupabaseClient(): void {
  supabaseClient = null;
  logger.info('Supabase client closed');
}
