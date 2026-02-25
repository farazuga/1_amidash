'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type { RockWithOwner } from '@/types/l10';
import {
  validateInput,
  createRockSchema,
  updateRockSchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getRocks(
  teamId: string,
  quarter?: string
): Promise<ActionResult<RockWithOwner[]>> {
  try {
    const { supabase } = await getL10Client();
    let query = supabase
      .from('l10_rocks')
      .select('*, profiles ( id, full_name, email )')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (quarter) {
      query = query.eq('quarter', quarter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: (data || []) as RockWithOwner[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createRock(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createRockSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { teamId, title, ownerId, quarter } = validation.data;

    const { error } = await supabase
      .from('l10_rocks')
      .insert({
        team_id: teamId,
        title,
        owner_id: ownerId || null,
        quarter,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRock(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateRockSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, ...updates } = validation.data;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const { error } = await supabase
      .from('l10_rocks')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteRock(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('l10_rocks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function toggleRockStatus(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();

    const { data: rock, error: fetchError } = await supabase
      .from('l10_rocks')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const newStatus = rock.status === 'on_track' ? 'off_track' : 'on_track';
    const { error } = await supabase
      .from('l10_rocks')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function dropRockToIssue(rockId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getL10Client();

    const { data: rock, error: fetchError } = await supabase
      .from('l10_rocks')
      .select('team_id, title')
      .eq('id', rockId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('l10_issues')
      .insert({
        team_id: rock.team_id,
        title: rock.title,
        created_by: user.id,
        source_type: 'rock',
        source_id: rockId,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
