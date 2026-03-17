// GET /api/calendar/outlook-events?engineers=id1,id2&start=2026-03-16&end=2026-03-20
// Returns read-only Outlook events for specified engineers in date range
// Only accessible to admin/editor roles

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCalendarEvents } from '@/lib/microsoft-graph/client';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check admin/editor role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile?.role || !['admin', 'editor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const engineerIds = searchParams.get('engineers')?.split(',').filter(Boolean) || [];
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end || engineerIds.length === 0) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Look up engineer emails
  const { data: engineers } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', engineerIds);

  if (!engineers) return NextResponse.json({ events: {} });

  // Fetch Outlook events for each engineer in parallel
  const results: Record<string, unknown[]> = {};

  await Promise.all(
    engineers.map(async (eng) => {
      try {
        const events = await getCalendarEvents(eng.email, start, end);
        results[eng.id] = events;
      } catch (error) {
        console.error(`Failed to fetch Outlook events for ${eng.email}:`, error);
        results[eng.id] = [];
      }
    })
  );

  return NextResponse.json({ events: results });
}
