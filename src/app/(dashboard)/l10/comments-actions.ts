'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type { CommentWithUser, CommentEntityType } from '@/types/l10';
import {
  validateInput,
  createCommentSchema,
  updateCommentSchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// l10_comments table not yet in generated types — use untyped access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commentsTable(supabase: any) {
  return supabase.from('l10_comments');
}

export async function getComments(
  entityType: CommentEntityType,
  entityId: string
): Promise<ActionResult<CommentWithUser[]>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await commentsTable(supabase)
      .select('*, profiles ( id, full_name, email )')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { success: true, data: (data || []) as CommentWithUser[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createComment(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createCommentSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { entityType, entityId, content } = validation.data;

    const { error } = await commentsTable(supabase)
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        content,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateComment(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateCommentSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, content } = validation.data;

    const { error } = await commentsTable(supabase)
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteComment(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await commentsTable(supabase)
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
