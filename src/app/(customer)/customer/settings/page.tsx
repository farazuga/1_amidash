export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { EmailNotificationToggle } from '@/components/customer/email-notification-toggle';
import { ArrowLeft } from 'lucide-react';

async function getEmailPreference(userEmail: string) {
  const supabase = await createClient();

  // Use type assertion since the table is created by a new migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from as any)('email_notification_preferences')
    .select('notifications_enabled')
    .eq('email', userEmail.toLowerCase())
    .single();

  // Default to true if no preference exists
  return data?.notifications_enabled ?? true;
}

export default async function CustomerSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Error loading user data
      </div>
    );
  }

  const emailEnabled = await getEmailPreference(user.email);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/customer">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#023A2D]">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences
        </p>
      </div>

      <EmailNotificationToggle email={user.email} initialEnabled={emailEnabled} />
    </div>
  );
}
