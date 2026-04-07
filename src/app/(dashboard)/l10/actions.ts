'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type {
  Team,
  TeamWithMembers,
  Meeting,
  MeetingWithDetails,
  MeetingSegment,
} from '@/types/l10';
import {
  validateInput,
  createTeamSchema,
  updateTeamSchema,
  teamMemberSchema,
  updateTeamMemberRoleSchema,
  startMeetingSchema,
  advanceSegmentSchema,
  submitRatingSchema,
} from '@/lib/l10/validation';

// ============================================
// Result types
// ============================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Team Actions
// ============================================

export async function getTeams(): Promise<ActionResult<Team[]>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getTeam(teamId: string): Promise<ActionResult<TeamWithMembers>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        team_members (
          id, team_id, user_id, role, created_at,
          profiles ( id, full_name, email )
        )
      `)
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return { success: true, data: data as TeamWithMembers };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createTeam(input: unknown): Promise<ActionResult<Team>> {
  try {
    const validation = validateInput(createTeamSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { name, description } = validation.data;

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name, description: description || null, created_by: user.id })
      .select()
      .single();

    if (teamError) throw teamError;

    // Add creator as team admin
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, user_id: user.id, role: 'admin' });

    if (memberError) throw memberError;

    revalidatePath('/l10');
    return { success: true, data: team };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTeam(input: unknown): Promise<ActionResult<Team>> {
  try {
    const validation = validateInput(updateTeamSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, ...updates } = validation.data;

    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================
// Team Member Actions
// ============================================

export async function addTeamMember(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(teamMemberSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { teamId, userId, role } = validation.data;

    const { error } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: userId, role });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'User is already a team member' };
      }
      throw error;
    }
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function removeTeamMember(input: { teamId: string; userId: string }): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', input.teamId)
      .eq('user_id', input.userId);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTeamMemberRole(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateTeamMemberRoleSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { teamId, userId, role } = validation.data;

    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getUsers(): Promise<ActionResult<{ id: string; full_name: string | null; email: string }[]>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================
// Meeting Actions
// ============================================

export async function startMeeting(input: unknown): Promise<ActionResult<Meeting>> {
  try {
    const validation = validateInput(startMeetingSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { teamId, title } = validation.data;

    // Check no active meeting for this team
    const { data: activeMeeting } = await supabase
      .from('l10_meetings')
      .select('id')
      .eq('team_id', teamId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (activeMeeting) {
      return { success: false, error: 'A meeting is already in progress for this team' };
    }

    // Create meeting
    const now = new Date().toISOString();
    const { data: meeting, error: meetingError } = await supabase
      .from('l10_meetings')
      .insert({
        team_id: teamId,
        title: title || 'L10 Meeting',
        started_at: now,
        current_segment: 'segue' as MeetingSegment,
        segment_started_at: now,
        status: 'in_progress',
        facilitator_id: user.id,
      })
      .select()
      .single();

    if (meetingError) throw meetingError;

    // Auto-add all team members as attendees
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    if (members && members.length > 0) {
      const attendees = members.map((m) => ({
        meeting_id: meeting.id,
        user_id: m.user_id,
        is_present: true,
      }));
      await supabase.from('l10_meeting_attendees').insert(attendees);
    }

    revalidatePath('/l10');
    return { success: true, data: meeting as Meeting };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function advanceMeetingSegment(input: unknown): Promise<ActionResult<Meeting>> {
  try {
    const validation = validateInput(advanceSegmentSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { meetingId, segment } = validation.data;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('l10_meetings')
      .update({
        current_segment: segment,
        segment_started_at: now,
      })
      .eq('id', meetingId)
      .eq('status', 'in_progress')
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: data as Meeting };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function endMeeting(meetingId: string): Promise<ActionResult<Meeting>> {
  try {
    const { supabase } = await getL10Client();

    // Calculate average rating
    const { data: ratings } = await supabase
      .from('l10_meeting_ratings')
      .select('rating')
      .eq('meeting_id', meetingId);

    let averageRating = null;
    if (ratings && ratings.length > 0) {
      const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
      averageRating = Math.round((sum / ratings.length) * 10) / 10;
    }

    const { data, error } = await supabase
      .from('l10_meetings')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        current_segment: null,
        average_rating: averageRating,
      })
      .eq('id', meetingId)
      .select()
      .single();

    if (error) throw error;

    // Reset any issues stuck in 'solving' back to 'open'
    if (data?.team_id) {
      await supabase
        .from('l10_issues')
        .update({ status: 'open' })
        .eq('team_id', data.team_id)
        .eq('status', 'solving');
    }

    revalidatePath('/l10');
    return { success: true, data: data as Meeting };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getMeeting(meetingId: string): Promise<ActionResult<MeetingWithDetails>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('l10_meetings')
      .select(`
        *,
        profiles ( id, full_name, email ),
        l10_meeting_attendees (
          id, meeting_id, user_id, is_present, joined_at,
          profiles ( id, full_name, email )
        ),
        l10_meeting_ratings ( id, meeting_id, user_id, rating, explanation, created_at )
      `)
      .eq('id', meetingId)
      .single();

    if (error) throw error;
    return { success: true, data: data as MeetingWithDetails };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getActiveMeeting(teamId: string): Promise<ActionResult<MeetingWithDetails | null>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('l10_meetings')
      .select(`
        *,
        profiles ( id, full_name, email ),
        l10_meeting_attendees (
          id, meeting_id, user_id, is_present, joined_at,
          profiles ( id, full_name, email )
        ),
        l10_meeting_ratings ( id, meeting_id, user_id, rating, explanation, created_at )
      `)
      .eq('team_id', teamId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (error) throw error;
    return { success: true, data: data as MeetingWithDetails | null };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getMeetingHistory(
  teamId: string,
  limit = 20,
  offset = 0
): Promise<ActionResult<Meeting[]>> {
  try {
    const { supabase } = await getL10Client();
    const { data, error } = await supabase
      .from('l10_meetings')
      .select('*')
      .eq('team_id', teamId)
      .in('status', ['completed', 'cancelled'])
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { success: true, data: (data || []) as Meeting[] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function joinMeeting(meetingId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getL10Client();
    const { error } = await supabase
      .from('l10_meeting_attendees')
      .upsert(
        { meeting_id: meetingId, user_id: user.id, is_present: true },
        { onConflict: 'meeting_id,user_id' }
      );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function submitRating(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(submitRatingSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { meetingId, userId, rating, explanation } = validation.data;

    const targetUserId = userId || user.id;

    const { error } = await supabase
      .from('l10_meeting_ratings')
      .upsert(
        {
          meeting_id: meetingId,
          user_id: targetUserId,
          rating,
          explanation: explanation || null,
        },
        { onConflict: 'meeting_id,user_id' }
      );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
