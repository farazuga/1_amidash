import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateCalendar,
  buildConsolidatedEvents,
  calendarToString,
} from '@/lib/ical/generator';
import type { BookingStatus } from '@/types/calendar';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return new NextResponse('Invalid token', { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Look up subscription by token
    const { data: subscription, error: subError } = await supabase
      .from('calendar_subscriptions')
      .select('*')
      .eq('token', token)
      .single();

    if (subError || !subscription) {
      return new NextResponse('Subscription not found', { status: 404 });
    }

    // Update last_accessed_at
    await supabase
      .from('calendar_subscriptions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', subscription.id);

    // Build query based on feed type
    let calendarName = 'Amitrace Calendar';
    let calendarDescription = 'Project schedule calendar';
    let assignments: Array<{
      assignment_id: string;
      project_id: string;
      project_name: string;
      user_id: string;
      user_name: string | null;
      booking_status: BookingStatus;
      project_start_date: string;
      project_end_date: string;
    }> = [];

    if (subscription.feed_type === 'master') {
      // Master calendar - all assignments
      calendarName = 'Amitrace - All Projects';
      calendarDescription = 'All project assignments';

      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          id,
          project_id,
          user_id,
          booking_status,
          project:projects!inner(id, client_name, start_date, end_date),
          user:profiles!user_id(id, full_name)
        `)
        .not('project.start_date', 'is', null)
        .not('project.end_date', 'is', null);

      if (error) {
        console.error('Error fetching assignments:', error);
        return new NextResponse('Failed to fetch assignments', { status: 500 });
      }

      // Type assertion is safe here because we filter for non-null dates above
      assignments = (data || []).map((a) => ({
        assignment_id: a.id,
        project_id: a.project_id,
        project_name: a.project.client_name,
        user_id: a.user_id,
        user_name: (a.user as { id: string; full_name: string | null } | null)?.full_name || null,
        booking_status: a.booking_status as BookingStatus,
        project_start_date: a.project.start_date!,
        project_end_date: a.project.end_date!,
      }));
    } else if (subscription.feed_type === 'personal') {
      // Personal calendar - user's assignments only
      if (!subscription.user_id) {
        return new NextResponse('Invalid subscription', { status: 400 });
      }

      // Get user name for calendar title
      const { data: user } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', subscription.user_id)
        .single();

      calendarName = `Amitrace - ${user?.full_name || 'My'} Schedule`;
      calendarDescription = 'Personal project assignments';

      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          id,
          project_id,
          user_id,
          booking_status,
          project:projects!inner(id, client_name, start_date, end_date),
          user:profiles!user_id(id, full_name)
        `)
        .eq('user_id', subscription.user_id)
        .not('project.start_date', 'is', null)
        .not('project.end_date', 'is', null);

      if (error) {
        console.error('Error fetching assignments:', error);
        return new NextResponse('Failed to fetch assignments', { status: 500 });
      }

      // Type assertion is safe here because we filter for non-null dates above
      assignments = (data || []).map((a) => ({
        assignment_id: a.id,
        project_id: a.project_id,
        project_name: a.project.client_name,
        user_id: a.user_id,
        user_name: (a.user as { id: string; full_name: string | null } | null)?.full_name || null,
        booking_status: a.booking_status as BookingStatus,
        project_start_date: a.project.start_date!,
        project_end_date: a.project.end_date!,
      }));
    } else if (subscription.feed_type === 'project') {
      // Project calendar - specific project's assignments
      if (!subscription.project_id) {
        return new NextResponse('Invalid subscription', { status: 400 });
      }

      // Get project name for calendar title
      const { data: project } = await supabase
        .from('projects')
        .select('client_name')
        .eq('id', subscription.project_id)
        .single();

      calendarName = `Amitrace - ${project?.client_name || 'Project'} Schedule`;
      calendarDescription = `Schedule for ${project?.client_name || 'project'}`;

      const { data, error } = await supabase
        .from('project_assignments')
        .select(`
          id,
          project_id,
          user_id,
          booking_status,
          project:projects!inner(id, client_name, start_date, end_date),
          user:profiles!user_id(id, full_name)
        `)
        .eq('project_id', subscription.project_id)
        .not('project.start_date', 'is', null)
        .not('project.end_date', 'is', null);

      if (error) {
        console.error('Error fetching assignments:', error);
        return new NextResponse('Failed to fetch assignments', { status: 500 });
      }

      // Type assertion is safe here because we filter for non-null dates above
      assignments = (data || []).map((a) => ({
        assignment_id: a.id,
        project_id: a.project_id,
        project_name: a.project.client_name,
        user_id: a.user_id,
        user_name: (a.user as { id: string; full_name: string | null } | null)?.full_name || null,
        booking_status: a.booking_status as BookingStatus,
        project_start_date: a.project.start_date!,
        project_end_date: a.project.end_date!,
      }));
    }

    // Build consolidated events (as date ranges, not individual days)
    const events = buildConsolidatedEvents(assignments);

    // Generate iCal
    const calendar = generateCalendar({
      name: calendarName,
      description: calendarDescription,
      events,
    });

    const icalString = calendarToString(calendar);

    // Return as iCal file
    return new NextResponse(icalString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${calendarName.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('iCal generation error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
