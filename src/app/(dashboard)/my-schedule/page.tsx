import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MyScheduleContent } from './my-schedule-content';
import { OutlookConnection } from '@/components/settings/outlook-connection';
import { isMicrosoftConfigured } from '@/lib/microsoft-graph/auth';

export const metadata = {
  title: 'My Schedule | Amitrace',
  description: 'Your personal project schedule',
};

export default async function MySchedulePage() {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'customer') {
    redirect('/');
  }

  // Get user's Outlook calendar connection if Microsoft is configured
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let calendarConnection: any = null;
  if (isMicrosoftConfigured()) {
    // Type cast needed until types are regenerated with new calendar_connections table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection } = await (supabase as any)
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();
    calendarConnection = connection;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="text-muted-foreground">
          Your personal project assignments and schedule
        </p>
      </div>

      <div className="space-y-6">
        <MyScheduleContent
          userId={user.id}
          userName={profile.full_name || undefined}
        />

        {isMicrosoftConfigured() && (
          <div className="mt-8 border-t pt-8">
            <h2 className="mb-4 text-lg font-semibold">Calendar Integration</h2>
            <div className="max-w-md">
              <OutlookConnection
                connection={calendarConnection}
                returnUrl="/my-schedule"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
