'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type { IssueWithCreator } from '@/types/l10';
import {
  validateInput,
  createIssueSchema,
  updateIssueSchema,
  reorderIssuesSchema,
  solveIssueSchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getIssues(
  teamId: string,
  status?: string
): Promise<ActionResult<IssueWithCreator[]>> {
  try {
    const { supabase } = await getL10Client();
    let query = supabase
      .from('l10_issues')
      .select('*, profiles ( id, full_name, email )')
      .eq('team_id', teamId)
      .order('priority_rank', { ascending: true })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['open', 'solving']);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: (data || []) as IssueWithCreator[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createIssue(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createIssueSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { teamId, title, description, sourceType, sourceId } = validation.data;

    const { error } = await supabase
      .from('l10_issues')
      .insert({
        team_id: teamId,
        title,
        description: description || null,
        created_by: user.id,
        source_type: sourceType || null,
        source_id: sourceId || null,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateIssue(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateIssueSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, ...updates } = validation.data;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
      if (updates.status === 'solved') {
        dbUpdates.resolved_at = new Date().toISOString();
      }
    }

    const { error } = await supabase
      .from('l10_issues')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteIssue(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('l10_issues')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function reorderIssues(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(reorderIssuesSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();

    for (const item of validation.data) {
      const { error } = await supabase
        .from('l10_issues')
        .update({ priority_rank: item.priority_rank })
        .eq('id', item.id);
      if (error) throw error;
    }

    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function solveIssue(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(solveIssueSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { id, todoTitle, todoOwnerId } = validation.data;

    // Get issue details
    const { data: issue, error: fetchError } = await supabase
      .from('l10_issues')
      .select('team_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Mark issue as solved
    const { error: updateError } = await supabase
      .from('l10_issues')
      .update({ status: 'solved', resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    // Optionally create a todo from the solution
    if (todoTitle) {
      const { error: todoError } = await supabase
        .from('l10_todos')
        .insert({
          team_id: issue.team_id,
          title: todoTitle,
          owner_id: todoOwnerId || user.id,
          source_issue_id: id,
        });
      if (todoError) throw todoError;
    }

    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
