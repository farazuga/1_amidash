import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PerDiemPage } from './per-diem-page';

export default async function PerDiemRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'customer') redirect('/');

  return <PerDiemPage isAdmin={profile.role === 'admin'} currentUserId={user.id} />;
}
