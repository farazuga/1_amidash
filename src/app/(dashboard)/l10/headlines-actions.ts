'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type { HeadlineWithCreator } from '@/types/l10';
import {
  validateInput,
  createHeadlineSchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getHeadlines(
  teamId: string,
  meetingId?: string
): Promise<ActionResult<HeadlineWithCreator[]>> {
  try {
    const { supabase } = await getL10Client();
    let query = supabase
      .from('l10_headlines')
      .select('*, profiles ( id, full_name, email )')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (meetingId) {
      query = query.eq('meeting_id', meetingId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: (data || []) as HeadlineWithCreator[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createHeadline(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createHeadlineSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { teamId, title, category, sentiment, meetingId } = validation.data;

    const { error } = await supabase
      .from('l10_headlines')
      .insert({
        team_id: teamId,
        title,
        category: category || null,
        sentiment: sentiment || 'neutral',
        created_by: user.id,
        meeting_id: meetingId || null,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteHeadline(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('l10_headlines')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function dropHeadlineToIssue(headlineId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getL10Client();

    const { data: headline, error: fetchError } = await supabase
      .from('l10_headlines')
      .select('team_id, title')
      .eq('id', headlineId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('l10_issues')
      .insert({
        team_id: headline.team_id,
        title: headline.title,
        created_by: user.id,
        source_type: 'headline',
        source_id: headlineId,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
