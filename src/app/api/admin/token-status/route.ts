import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppAccessToken } from '@/lib/microsoft-graph/auth';
import { internalError } from '@/lib/api/error-response';

export async function GET() {
  const supabase = await createClient();

  // Check admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check app credential health
  let appTokenStatus = 'unknown';
  try {
    await getAppAccessToken();
    appTokenStatus = 'valid';
  } catch (error) {
    console.error('[Token Status]', error);
    appTokenStatus = 'error: token validation failed';
  }

  // Get all engineer calendars
  const { data: calendars } = await supabase
    .from('engineer_outlook_calendars')
    .select('user_id, outlook_email, created_at, updated_at');

  // Get recent sync errors
  const { data: recentErrors } = await supabase
    .from('synced_calendar_events')
    .select('user_id, sync_error, last_synced_at')
    .not('sync_error', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    app_token: appTokenStatus,
    engineer_calendars: calendars?.length || 0,
    calendars: calendars || [],
    recent_errors: recentErrors || [],
    checked_at: new Date().toISOString(),
  });
}
