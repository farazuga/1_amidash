import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MyScheduleContent } from './my-schedule-content';

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

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="text-muted-foreground">
          Your personal project assignments and schedule
        </p>
      </div>

      <MyScheduleContent
        userId={user.id}
        userName={profile.full_name || undefined}
      />
    </div>
  );
}
