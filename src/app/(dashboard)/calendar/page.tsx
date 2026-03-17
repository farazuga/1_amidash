import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CalendarPageContent } from './calendar-page-content';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Master Calendar | Amitrace',
  description: 'View and manage project schedules and team assignments',
};

interface CalendarPageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const supabase = await createClient();
  const { project: projectParam } = await searchParams;

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

  // Fetch project if ?project= param is present (server-side)
  let initialProject = null;
  if (projectParam) {
    const isUUID = !projectParam.startsWith('S');
    const query = supabase.from('projects').select('*');
    const { data } = await (isUUID
      ? query.eq('id', projectParam)
      : query.eq('sales_order_number', projectParam)
    ).single();
    initialProject = data;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Master Calendar</h1>
        <p className="text-muted-foreground">
          Manage assignments and schedules across all projects
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[500px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <CalendarPageContent isAdmin={isAdmin} initialProject={initialProject as any} />
      </Suspense>
    </div>
  );
}
