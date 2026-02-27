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

/** Compute quarter end date: Q1→Mar 31, Q2→Jun 30, Q3→Sep 30, Q4→Dec 31 */
function getQuarterEndDate(quarter: string): string {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return '';
  const year = match[1];
  const q = parseInt(match[2]);
  const ends: Record<number, string> = {
    1: `${year}-03-31`,
    2: `${year}-06-30`,
    3: `${year}-09-30`,
    4: `${year}-12-31`,
  };
  return ends[q];
}

export async function getRocks(
  teamId: string,
  quarter?: string,
  showArchived = false
): Promise<ActionResult<RockWithOwner[]>> {
  try {
    const { supabase } = await getL10Client();
    let query = supabase
      .from('l10_rocks')
      .select('*, profiles ( id, full_name, email ), milestones:l10_rock_milestones ( id, is_complete )')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (quarter) {
      query = query.eq('quarter', quarter);
    }

    if (!showArchived) {
      query = query.eq('is_archived', false);
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
    const { teamId, title, description, ownerId, quarter, dueDate } = validation.data;

    const { error } = await supabase
      .from('l10_rocks')
      .insert({
        team_id: teamId,
        title,
        description: description || null,
        owner_id: ownerId || null,
        quarter,
        due_date: dueDate || getQuarterEndDate(quarter) || null,
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
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;

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

export async function archiveRock(id: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getL10Client();

    // Get rock's team_id
    const { data: rock, error: fetchError } = await supabase
      .from('l10_rocks')
      .select('team_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Check user is admin/facilitator
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', rock.team_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'facilitator'].includes(membership.role)) {
      // Check if global admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        return { success: false, error: 'Only team admins or facilitators can archive rocks' };
      }
    }

    const { error } = await supabase
      .from('l10_rocks')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
