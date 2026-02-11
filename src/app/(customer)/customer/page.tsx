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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveClientVisibleStatuses(projects: any[]) {
  // Find projects where current status is internal-only
  const internalProjects = projects.filter(
    (p) => p.current_status?.is_internal_only
  );

  if (internalProjects.length === 0) return projects;

  // For each internal-only project, fetch the latest non-internal status from history
  const supabase = await createClient();
  const resolved = await Promise.all(
    internalProjects.map(async (project) => {
      const { data: history } = await supabase
        .from('status_history')
        .select('*, status:statuses(*)')
        .eq('project_id', project.id)
        .order('changed_at', { ascending: false });

      const lastVisible = (history || []).find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => entry.status && !entry.status.is_internal_only
      );

      return {
        projectId: project.id,
        clientVisibleStatus: lastVisible?.status || null,
      };
    })
  );

  const resolvedMap = new Map(
    resolved.map((r) => [r.projectId, r.clientVisibleStatus])
  );

  return projects.map((p) => {
    if (p.current_status?.is_internal_only && resolvedMap.has(p.id)) {
      return { ...p, current_status: resolvedMap.get(p.id) };
    }
    return p;
  });
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

  const [rawProjects, emailEnabled] = await Promise.all([
    getCustomerProjects(user.email),
    getEmailPreference(user.email),
  ]);

  // For projects whose current status is internal-only, resolve to last client-visible status
  const projects = await resolveClientVisibleStatuses(rawProjects);

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
