export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { CustomerProjectsTable } from '@/components/customer/customer-projects-table';
import { EmailNotificationToggle } from '@/components/customer/email-notification-toggle';

async function getCustomerProjects(userEmail: string) {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id,
      client_name,
      created_date,
      sales_order_number,
      goal_completion_date,
      current_status_id,
      poc_name,
      poc_email,
      client_token,
      current_status:statuses(*),
      project_type:project_types(*)
    `)
    .ilike('poc_email', userEmail)
    .order('created_date', { ascending: false });

  return projects || [];
}

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

export default async function CustomerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Error loading user data
      </div>
    );
  }

  const [projects, emailEnabled] = await Promise.all([
    getCustomerProjects(user.email),
    getEmailPreference(user.email),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#023A2D]">Welcome to Your Portal</h1>
        <p className="text-muted-foreground">
          View the status of all your projects with Amitrace
        </p>
      </div>

      <EmailNotificationToggle email={user.email} initialEnabled={emailEnabled} />

      <CustomerProjectsTable projects={projects} />
    </div>
  );
}
