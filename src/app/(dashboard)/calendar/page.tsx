import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CalendarPageContent } from './calendar-page-content';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Calendar | Amitrace',
  description: 'Project scheduling calendar',
};

export default async function CalendarPage() {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user's profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'customer') {
    redirect('/');
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Project Calendar</h1>
        <p className="text-muted-foreground">
          View and manage project schedules and team assignments
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[500px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <CalendarPageContent isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
