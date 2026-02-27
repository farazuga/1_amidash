'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type { TodoWithOwner } from '@/types/l10';
import {
  validateInput,
  createTodoSchema,
  updateTodoSchema,
  convertTodoToIssueSchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getTodos(
  teamId: string,
  showDone = false
): Promise<ActionResult<TodoWithOwner[]>> {
  try {
    const { supabase } = await getL10Client();
    let query = supabase
      .from('l10_todos')
      .select('*, profiles ( id, full_name, email ), source_issue:l10_issues ( id, title, status, source_type, source_meta ), source_milestone:l10_rock_milestones ( id, title, rock:l10_rocks ( id, title ) )')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (!showDone) {
      query = query.eq('is_done', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: (data || []) as TodoWithOwner[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createTodo(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createTodoSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { teamId, title, ownerId, dueDate, sourceMeetingId, sourceIssueId, sourceMilestoneId } = validation.data;

    const { error } = await supabase
      .from('l10_todos')
      .insert({
        team_id: teamId,
        title,
        owner_id: ownerId || null,
        due_date: dueDate || null,
        source_meeting_id: sourceMeetingId || null,
        source_issue_id: sourceIssueId || null,
        source_milestone_id: sourceMilestoneId || null,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTodo(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateTodoSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, ...updates } = validation.data;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.isDone !== undefined) dbUpdates.is_done = updates.isDone;

    const { error } = await supabase
      .from('l10_todos')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function toggleTodo(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();

    const { data: todo, error: fetchError } = await supabase
      .from('l10_todos')
      .select('is_done')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('l10_todos')
      .update({ is_done: !todo.is_done })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('l10_todos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export interface MyTodoWithTeam extends TodoWithOwner {
  team_name?: string;
}

export async function getMyTodos(
  userId: string,
  teamId?: string
): Promise<ActionResult<MyTodoWithTeam[]>> {
  try {
    const { supabase } = await getL10Client();

    // Get teams this user is a member of
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, teams ( name )')
      .eq('user_id', userId);

    if (memberError) throw memberError;
    if (!memberships || memberships.length === 0) {
      return { success: true, data: [] };
    }

    const teamIds = teamId
      ? [teamId]
      : memberships.map((m) => m.team_id);

    const teamNameMap = new Map<string, string>();
    for (const m of memberships) {
      const team = m.teams as unknown as { name: string } | null;
      teamNameMap.set(m.team_id, team?.name || 'Unknown');
    }

    const { data, error } = await supabase
      .from('l10_todos')
      .select('*, profiles ( id, full_name, email ), source_issue:l10_issues ( id, title, status, source_type, source_meta ), source_milestone:l10_rock_milestones ( id, title, rock:l10_rocks ( id, title ) )')
      .in('team_id', teamIds)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const todos = (data || []).map((t) => ({
      ...t,
      team_name: teamNameMap.get(t.team_id) || 'Unknown',
    })) as MyTodoWithTeam[];

    return { success: true, data: todos };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getOverdueTodoCount(
  userId: string
): Promise<ActionResult<number>> {
  try {
    const { supabase } = await getL10Client();
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await supabase
      .from('l10_todos')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('is_done', false)
      .lt('due_date', today);

    if (error) throw error;
    return { success: true, data: count || 0 };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function convertTodoToIssue(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(convertTodoToIssueSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { todoId } = validation.data;

    // Fetch the todo (description column not yet in generated types, cast via any)
    const { data: todo, error: fetchError } = await supabase
      .from('l10_todos')
      .select('team_id, title')
      .eq('id', todoId)
      .single();

    if (fetchError) throw fetchError;

    // Also fetch description via untyped query since column is new
    const { data: todoFull } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from('l10_todos')
      .select('description')
      .eq('id', todoId)
      .single();

    // Create issue from todo
    const { error: insertError } = await supabase
      .from('l10_issues')
      .insert({
        team_id: todo.team_id,
        title: todo.title,
        description: (todoFull?.description as string) || null,
        created_by: user.id,
        source_type: 'todo',
        source_id: todoId,
      });

    if (insertError) throw insertError;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
