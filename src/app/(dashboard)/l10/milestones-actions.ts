'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type { RockMilestoneWithOwner } from '@/types/l10';
import {
  validateInput,
  createMilestoneSchema,
  updateMilestoneSchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getMilestones(
  rockId: string
): Promise<ActionResult<RockMilestoneWithOwner[]>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('l10_rock_milestones')
      .select('*, profiles ( id, full_name, email )')
      .eq('rock_id', rockId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return { success: true, data: (data || []) as RockMilestoneWithOwner[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createMilestone(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createMilestoneSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { rockId, title, dueDate, ownerId } = validation.data;

    // Get max display_order
    const { data: existing } = await supabase
      .from('l10_rock_milestones')
      .select('display_order')
      .eq('rock_id', rockId)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = existing?.[0]?.display_order ?? -1;

    const { error } = await supabase
      .from('l10_rock_milestones')
      .insert({
        rock_id: rockId,
        title,
        due_date: dueDate || null,
        owner_id: ownerId || null,
        display_order: maxOrder + 1,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateMilestone(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateMilestoneSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, ...updates } = validation.data;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    if (updates.isComplete !== undefined) dbUpdates.is_complete = updates.isComplete;

    const { error } = await supabase
      .from('l10_rock_milestones')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('l10_rock_milestones')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function toggleMilestone(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();

    const { data: milestone, error: fetchError } = await supabase
      .from('l10_rock_milestones')
      .select('is_complete')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('l10_rock_milestones')
      .update({ is_complete: !milestone.is_complete })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Auto-convert milestones due within 7 days to todos.
 * Creates a todo for each qualifying milestone that doesn't already have a linked todo.
 */
export async function convertDueMilestones(
  teamId: string
): Promise<ActionResult<number>> {
  try {
    const { supabase } = await getL10Client();

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const cutoff = sevenDaysFromNow.toISOString().split('T')[0];

    // Find milestones due within 7 days, not complete, belonging to team's rocks
    const { data: milestones, error: fetchError } = await supabase
      .from('l10_rock_milestones')
      .select('id, title, due_date, owner_id, rock:l10_rocks!inner ( id, team_id, title, owner_id )')
      .eq('is_complete', false)
      .lte('due_date', cutoff)
      .not('due_date', 'is', null);

    if (fetchError) throw fetchError;

    // Filter to this team's rocks
    type RockJoin = { id: string; team_id: string; title: string; owner_id: string | null };
    const allMilestones = (milestones || []) as (typeof milestones extends (infer U)[] | null ? U : never)[];
    const teamMilestones = allMilestones.filter((m) => {
      const rock = m.rock as unknown as RockJoin;
      return rock.team_id === teamId;
    });

    if (teamMilestones.length === 0) {
      return { success: true, data: 0 };
    }

    // Check which milestones already have linked todos
    const milestoneIds = teamMilestones.map((m) => m.id);
    const { data: existingTodos } = await supabase
      .from('l10_todos')
      .select('source_milestone_id')
      .in('source_milestone_id', milestoneIds);

    const alreadyLinked = new Set(
      (existingTodos || []).map((t) => t.source_milestone_id)
    );

    const toCreate = teamMilestones.filter((m) => !alreadyLinked.has(m.id));

    if (toCreate.length === 0) {
      return { success: true, data: 0 };
    }

    // Create todos
    const todosToInsert = toCreate.map((m) => {
      const rock = m.rock as unknown as RockJoin;
      return {
        team_id: teamId,
        title: m.title,
        owner_id: m.owner_id || rock.owner_id || null,
        due_date: m.due_date,
        source_milestone_id: m.id,
      };
    });

    const { error: insertError } = await supabase
      .from('l10_todos')
      .insert(todosToInsert);

    if (insertError) throw insertError;
    revalidatePath('/l10');
    return { success: true, data: toCreate.length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
