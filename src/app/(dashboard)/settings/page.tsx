import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Globe, Lock } from 'lucide-react';
import { TimezoneSelect } from './timezone-select';
import { ChangePasswordForm } from './change-password-form';

export const metadata = {
  title: 'Settings | Amitrace',
  description: 'Manage your account settings',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user's profile - timezone and user_preferences might not exist until migration runs
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Customers have their own settings page
  if (profile.role === 'customer') {
    redirect('/customer/settings');
  }

  // Try to get timezone (may not exist until migration runs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileWithTimezone = profile as any;
  const timezone = profileWithTimezone.timezone || 'America/New_York';

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your account preferences and integrations
        </p>
      </div>

      <div className="space-y-6">
        {/* Timezone */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Timezone</CardTitle>
            </div>
            <CardDescription>
              Set your timezone for calendar events and date displays
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimezoneSelect currentTimezone={timezone} />
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
