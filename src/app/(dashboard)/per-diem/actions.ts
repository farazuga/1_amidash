'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  PerDiemRates,
  PerDiemDeposit,
  PerDiemEntry,
  PerDiemBalance,
} from '@/types/per-diem';
import {
  validateInput,
  updateRatesSchema,
  createDepositsSchema,
  updateDepositSchema,
  createEntrySchema,
  updateEntrySchema,
  approveEntriesSchema,
} from '@/lib/per-diem/validation';

// ============================================
// Result types
// ============================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Auth helper
// ============================================

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Profile not found');
  return { user, profile, isAdmin: profile.role === 'admin' };
}

// ============================================
// Rate Actions
// ============================================

export async function getRates(): Promise<ActionResult<PerDiemRates>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('per_diem_rates')
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data: data as PerDiemRates };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRates(input: unknown): Promise<ActionResult<PerDiemRates>> {
  try {
    const validation = validateInput(updateRatesSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);
    if (!isAdmin) return { success: false, error: 'Admin access required' };

    const { data, error } = await supabase
      .from('per_diem_rates')
      .update({
        in_state_rate: validation.data.in_state_rate,
        out_of_state_rate: validation.data.out_of_state_rate,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true, data: data as PerDiemRates };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================
// Deposit Actions
// ============================================

export async function getDeposits(userId?: string): Promise<ActionResult<PerDiemDeposit[]>> {
  try {
    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);

    const targetUserId = isAdmin ? userId : user.id;

    let query = supabase
      .from('per_diem_deposits')
      .select('*, user:profiles!per_diem_deposits_user_id_fkey(id, full_name, email)')
      .order('created_at', { ascending: false });

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: (data || []) as PerDiemDeposit[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createDeposits(input: unknown): Promise<ActionResult<PerDiemDeposit[]>> {
  try {
    const validation = validateInput(createDepositsSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);
    if (!isAdmin) return { success: false, error: 'Admin access required' };

    const rows = validation.data.deposits.map((d) => ({
      user_id: d.user_id,
      amount: d.amount,
      note: d.note || null,
      created_by: user.id,
    }));

    const { data, error } = await supabase
      .from('per_diem_deposits')
      .insert(rows)
      .select();

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true, data: (data || []) as PerDiemDeposit[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDeposit(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateDepositSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const supabase = await createClient();
    const { isAdmin } = await getAuthenticatedUser(supabase);
    if (!isAdmin) return { success: false, error: 'Admin access required' };

    const { id, ...updates } = validation.data;
    const { error } = await supabase
      .from('per_diem_deposits')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================
// Entry Actions
// ============================================

export async function getEntries(
  filters?: { userId?: string; year?: number; status?: string }
): Promise<ActionResult<PerDiemEntry[]>> {
  try {
    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);

    const targetUserId = isAdmin ? filters?.userId : user.id;

    let query = supabase
      .from('per_diem_entries')
      .select(`
        *,
        user:profiles!per_diem_entries_user_id_fkey(id, full_name, email),
        project:projects!per_diem_entries_project_id_fkey(id, client_name, sales_order_number, delivery_state)
      `)
      .order('start_date', { ascending: false });

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    if (filters?.year) {
      query = query
        .gte('start_date', `${filters.year}-01-01`)
        .lte('start_date', `${filters.year}-12-31`);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: (data || []) as PerDiemEntry[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createEntry(input: unknown): Promise<ActionResult<PerDiemEntry>> {
  try {
    const validation = validateInput(createEntrySchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);

    const row = {
      ...validation.data,
      user_id: isAdmin ? validation.data.user_id : user.id,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from('per_diem_entries')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true, data: data as PerDiemEntry };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateEntry(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateEntrySchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);

    const { id, ...updates } = validation.data;

    // Fetch existing entry to check ownership and status
    const { data: existing, error: fetchError } = await supabase
      .from('per_diem_entries')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) return { success: false, error: 'Entry not found' };

    if (!isAdmin) {
      if (existing.user_id !== user.id) {
        return { success: false, error: 'You can only edit your own entries' };
      }
      if (existing.status !== 'pending') {
        return { success: false, error: 'Only pending entries can be edited' };
      }
    }

    const { error } = await supabase
      .from('per_diem_entries')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);

    // Fetch existing entry to check ownership and status
    const { data: existing, error: fetchError } = await supabase
      .from('per_diem_entries')
      .select('id, user_id, status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) return { success: false, error: 'Entry not found' };

    if (existing.status !== 'pending') {
      return { success: false, error: 'Only pending entries can be deleted' };
    }

    if (!isAdmin && existing.user_id !== user.id) {
      return { success: false, error: 'You can only delete your own entries' };
    }

    const { error } = await supabase
      .from('per_diem_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function approveEntries(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(approveEntriesSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const supabase = await createClient();
    const { isAdmin } = await getAuthenticatedUser(supabase);
    if (!isAdmin) return { success: false, error: 'Admin access required' };

    const { error } = await supabase
      .from('per_diem_entries')
      .update({ status: 'approved' })
      .in('id', validation.data.entry_ids);

    if (error) throw error;
    revalidatePath('/per-diem');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================
// Balance Action
// ============================================

export async function getBalance(userId?: string): Promise<ActionResult<PerDiemBalance>> {
  try {
    const supabase = await createClient();
    const { isAdmin, user } = await getAuthenticatedUser(supabase);

    const targetUserId = isAdmin && userId ? userId : user.id;

    // Sum deposits
    const { data: deposits, error: depositsError } = await supabase
      .from('per_diem_deposits')
      .select('amount')
      .eq('user_id', targetUserId);

    if (depositsError) throw depositsError;

    const total_deposited = (deposits || []).reduce((sum, d) => sum + d.amount, 0);

    // Sum approved entries
    const { data: approvedEntries, error: approvedError } = await supabase
      .from('per_diem_entries')
      .select('total')
      .eq('user_id', targetUserId)
      .eq('status', 'approved');

    if (approvedError) throw approvedError;

    const total_spent = (approvedEntries || []).reduce((sum, e) => sum + e.total, 0);

    // Sum pending entries
    const { data: pendingEntries, error: pendingError } = await supabase
      .from('per_diem_entries')
      .select('total')
      .eq('user_id', targetUserId)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    const total_pending = (pendingEntries || []).reduce((sum, e) => sum + e.total, 0);

    const balance: PerDiemBalance = {
      total_deposited,
      total_spent,
      total_pending,
      balance: total_deposited - total_spent,
    };

    return { success: true, data: balance };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================
// Utility Actions
// ============================================

export async function getStaffUsers(): Promise<
  ActionResult<{ id: string; full_name: string | null; email: string }[]>
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .neq('role', 'customer')
      .order('full_name');

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function searchProjects(
  query: string
): Promise<
  ActionResult<
    { id: string; client_name: string; sales_order_number: string | null; delivery_state: string | null }[]
  >
> {
  try {
    if (query.length < 2) {
      return { success: true, data: [] };
    }

    const supabase = await createClient();

    // Look up status IDs for 'Invoiced' and 'Cancelled' to exclude
    const { data: excludedStatuses } = await supabase
      .from('statuses')
      .select('id')
      .in('name', ['Invoiced', 'Cancelled']);

    const excludedIds = (excludedStatuses || []).map((s) => s.id);

    let projectQuery = supabase
      .from('projects')
      .select('id, client_name, sales_order_number, delivery_state')
      .or(`client_name.ilike.%${query}%,sales_order_number.ilike.%${query}%`)
      .limit(20);

    if (excludedIds.length > 0) {
      projectQuery = projectQuery.not(
        'current_status_id',
        'in',
        `(${excludedIds.join(',')})`
      );
    }

    const { data, error } = await projectQuery;

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
