export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Toaster } from '@/components/ui/sonner';
import { CustomerHeader } from '@/components/customer/customer-header';
import { UserProvider } from '@/contexts/user-context';

async function getCustomerData() {
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

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCustomerData();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  // Redirect to dashboard if not a customer
  if (profile?.role !== 'customer') {
    redirect('/');
  }

  return (
    <UserProvider user={user} profile={profile}>
      <div className="min-h-screen bg-[#f8faf9]">
        <CustomerHeader user={user} profile={profile} />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          {children}
        </main>
        <Toaster position="top-right" />
      </div>
    </UserProvider>
  );
}
