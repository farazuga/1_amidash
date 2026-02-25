import { createClient } from '@/lib/supabase/server';

/**
 * Get an authenticated Supabase client for L10 tables.
 */
export async function getL10Client() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Not authenticated');
  }
  return { supabase, user };
}
