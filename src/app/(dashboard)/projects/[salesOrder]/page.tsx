import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectHeader } from '@/components/projects/project-header';
import { ProjectForm } from '@/components/projects/project-form';
import { StatusHistory } from '@/components/projects/status-history';
import { QuickInfo } from '@/components/projects/quick-info';
import { SubProjectsPanel } from '@/components/projects/sub-projects-panel';
import { ChildProjectBanner } from '@/components/projects/child-project-banner';
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
import { getSubProjects } from '@/app/(dashboard)/projects/actions';

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
  const [statuses, tags, statusHistory, salespeople, projectTypes, projectTypeStatuses, currentUser, subProjects] = await Promise.all([
    getCachedStatuses(),         // Cached: rarely changes
    getCachedTags(),             // Cached: rarely changes
    getStatusHistory(project.id), // Non-cached: project-specific
    getCachedSalespeople(),      // Cached: changes occasionally
    getCachedProjectTypes(),     // Cached: rarely changes
    getCachedProjectTypeStatuses(), // Cached: rarely changes
    getCurrentUser(),            // Non-cached: session-specific
    getSubProjects(project.id),  // Fetch sub-projects
  ]);

  const isAdmin = currentUser?.role === 'admin';
  const canEditSchedule = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const hasProjectDates = Boolean(project?.start_date && project?.end_date);

  const isOverdue =
    project.goal_completion_date &&
    new Date(project.goal_completion_date) < new Date() &&
    project.current_status?.name !== 'Invoiced';

  const isChildProject = !!(project as { parent_project_id?: string | null }).parent_project_id;
  const isParentProject = (project.children_count ?? 0) > 0;
  const showSubProjectsTab = !isChildProject; // Don't show sub-projects tab on child projects

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
      {/* Left Column - 60% (3/5) */}
      <div className="lg:col-span-3 space-y-4 md:space-y-6">
        {/* Child project banner */}
        {isChildProject && project.parent_project && (
          <ChildProjectBanner
            parentProject={project.parent_project}
            childProjectId={project.id}
            isAdmin={isAdmin}
          />
        )}

        {/* Hero Header */}
        <ProjectHeader
          project={{
            client_name: project.client_name,
            created_at: project.created_at,
            created_date: project.created_date ?? null,
            created_by_profile: project.created_by_profile,
            salesperson: project.salesperson,
          }}
          salesOrder={salesOrder}
          isOverdue={!!isOverdue}
        />

        {showSubProjectsTab ? (
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Project Info</TabsTrigger>
              <TabsTrigger value="sub-projects">
                Sub-Projects{subProjects.length > 0 ? ` (${subProjects.length})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 md:space-y-6 mt-4">
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
            </TabsContent>

            <TabsContent value="sub-projects" className="mt-4">
              <SubProjectsPanel
                parentId={project.id}
                parentSalesOrder={project.sales_order_number}
                parentClientName={project.client_name}
                subProjects={subProjects}
                isAdmin={isAdmin}
              />
            </TabsContent>
          </Tabs>
        ) : (
          /* Child projects or projects without tabs: show info directly */
          <>
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
          </>
        )}
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
              created_at: project.created_at,
              created_date: project.created_date ?? null,
              invoiced_date: (project as { invoiced_date?: string | null }).invoiced_date ?? null,
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
              project_type_id: project.project_type_id,
              // Delivery address
              delivery_street: (project as { delivery_street?: string | null }).delivery_street ?? null,
              delivery_city: (project as { delivery_city?: string | null }).delivery_city ?? null,
              delivery_state: (project as { delivery_state?: string | null }).delivery_state ?? null,
              delivery_zip: (project as { delivery_zip?: string | null }).delivery_zip ?? null,
              // Odoo integration
              odoo_order_id: (project as { odoo_order_id?: number | null }).odoo_order_id ?? null,
              odoo_invoice_status: (project as { odoo_invoice_status?: string | null }).odoo_invoice_status ?? null,
              odoo_last_synced_at: (project as { odoo_last_synced_at?: string | null }).odoo_last_synced_at ?? null,
              project_description: (project as { project_description?: string | null }).project_description ?? null,
            }}
            statuses={statuses}
            projectTypeStatuses={projectTypeStatuses}
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
