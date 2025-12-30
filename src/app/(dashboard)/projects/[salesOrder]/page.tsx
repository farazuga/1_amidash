import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectHeader } from '@/components/projects/project-header';
import { ProjectForm } from '@/components/projects/project-form';
import { StatusHistory } from '@/components/projects/status-history';
import { QuickInfo } from '@/components/projects/quick-info';
import type { Project } from '@/types';
import type { BookingStatus } from '@/types/calendar';
import {
  getCachedStatuses,
  getCachedTags,
  getCachedProjectTypes,
  getCachedProjectTypeStatuses,
  getCachedSalespeople,
  getProjectBySalesOrder,
  getStatusHistory,
  getCurrentUser,
} from '@/lib/data/cached-queries';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ salesOrder: string }>;
}) {
  const { salesOrder } = await params;

  // Fetch project by sales order number first
  const project = await getProjectBySalesOrder(salesOrder);

  if (!project) {
    notFound();
  }

  // Use cached queries for static data, non-cached for dynamic data
  const [statuses, tags, statusHistory, salespeople, projectTypes, projectTypeStatuses, currentUser] = await Promise.all([
    getCachedStatuses(),         // Cached: rarely changes
    getCachedTags(),             // Cached: rarely changes
    getStatusHistory(project.id), // Non-cached: project-specific
    getCachedSalespeople(),      // Cached: changes occasionally
    getCachedProjectTypes(),     // Cached: rarely changes
    getCachedProjectTypeStatuses(), // Cached: rarely changes
    getCurrentUser(),            // Non-cached: session-specific
  ]);

  const isAdmin = currentUser?.role === 'admin';
  const canEditSchedule = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const hasProjectDates = Boolean(project?.start_date && project?.end_date);

  const isOverdue =
    project.goal_completion_date &&
    new Date(project.goal_completion_date) < new Date() &&
    project.current_status?.name !== 'Invoiced';

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
      {/* Left Column - 60% (3/5) */}
      <div className="lg:col-span-3 space-y-4 md:space-y-6">
        {/* Hero Header */}
        <ProjectHeader
          project={{
            client_name: project.client_name,
            created_at: project.created_at,
            created_by_profile: project.created_by_profile,
            salesperson: project.salesperson,
          }}
          isOverdue={!!isOverdue}
        />

        {/* Project Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Edit project details below</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectForm
              project={{ ...project, email_notifications_enabled: (project as { email_notifications_enabled?: boolean | null }).email_notifications_enabled ?? true } as Project}
              statuses={statuses}
              tags={tags}
              projectTags={project.tags?.map((t: { tag: { id: string } }) => t.tag.id) || []}
              salespeople={salespeople}
              projectTypes={projectTypes}
              projectTypeStatuses={projectTypeStatuses}
            />
          </CardContent>
        </Card>

        {/* Status History */}
        <Card>
          <CardHeader>
            <CardTitle>Status History</CardTitle>
            <CardDescription>Timeline of status changes</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusHistory history={statusHistory} />
          </CardContent>
        </Card>
      </div>

      {/* Right Column - 40% (2/5) - Quick Info */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-4">
          <QuickInfo
            project={{
              id: project.id,
              goal_completion_date: project.goal_completion_date,
              start_date: project.start_date,
              end_date: project.end_date,
              sales_amount: project.sales_amount,
              sales_order_number: project.sales_order_number,
              sales_order_url: project.sales_order_url,
              schedule_status: (project as { schedule_status?: string }).schedule_status as BookingStatus | null,
              current_status: project.current_status,
              salesperson: project.salesperson,
              salesperson_id: project.salesperson_id,
              poc_name: project.poc_name,
              poc_email: project.poc_email,
              poc_phone: project.poc_phone,
              scope_link: project.scope_link,
              client_name: project.client_name,
              client_token: project.client_token,
              client_portal_views: (project as { client_portal_views?: number }).client_portal_views,
            }}
            statuses={statuses}
            salespeople={salespeople}
            isOverdue={!!isOverdue}
            canEdit={isAdmin}
            canEditSchedule={canEditSchedule}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
