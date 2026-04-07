'use server';

import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export async function getApprovalUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await (supabase as AnySupabaseClient)
    .from('app_settings')
    .select('value')
    .eq('key', 'customer_approval_user_id')
    .single();

  if (!data?.value || data.value === 'null' || data.value === null) return null;
  // value is stored as jsonb - it might be a string with quotes
  const userId = typeof data.value === 'string' ? data.value.replace(/"/g, '') : data.value;
  return userId === 'null' ? null : userId;
}

export async function setApprovalUserId(userId: string | null): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await (supabase as AnySupabaseClient)
    .from('app_settings')
    .upsert({
      key: 'customer_approval_user_id',
      value: userId ? JSON.stringify(userId) : 'null',
    }, { onConflict: 'key' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getApprovalCandidates(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'editor'])
    .order('full_name');

  return (data || []) as Profile[];
}
