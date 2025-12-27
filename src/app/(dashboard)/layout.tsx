export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { DashboardContent } from '@/components/layout/dashboard-content';
import { Toaster } from '@/components/ui/sonner';
import { UserProvider } from '@/contexts/user-context';

async function getUserData() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getUserData();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  return (
    <UserProvider user={user} profile={profile}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
        <Toaster position="top-right" />
      </div>
    </UserProvider>
  );
}
