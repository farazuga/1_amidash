import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  User,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProjectHeader } from '@/components/projects/project-header';
import { ProjectForm } from '@/components/projects/project-form';
import { StatusHistory } from '@/components/projects/status-history';
import { ProjectScheduleStatus, ProjectScheduleStatusDisplay } from '@/components/projects/project-schedule-status';
import type { Project } from '@/types';
import type { BookingStatus } from '@/types/calendar';
import {
  getCachedStatuses,
  getCachedTags,
  getCachedProjectTypes,
  getCachedProjectTypeStatuses,
  getCachedSalespeople,
  getProject,
  getStatusHistory,
  getCurrentUser,
} from '@/lib/data/cached-queries';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Use cached queries for static data, non-cached for dynamic data
  const [project, statuses, tags, statusHistory, salespeople, projectTypes, projectTypeStatuses, currentUser] = await Promise.all([
    getProject(id),              // Non-cached: project-specific, changes often
    getCachedStatuses(),         // Cached: rarely changes
    getCachedTags(),             // Cached: rarely changes
    getStatusHistory(id),        // Non-cached: project-specific
    getCachedSalespeople(),      // Cached: changes occasionally
    getCachedProjectTypes(),     // Cached: rarely changes
    getCachedProjectTypeStatuses(), // Cached: rarely changes
    getCurrentUser(),            // Non-cached: session-specific
  ]);

  const isAdmin = currentUser?.role === 'admin';
  const canEditSchedule = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const hasProjectDates = Boolean(project?.start_date && project?.end_date);

  if (!project) {
    notFound();
  }

  const isOverdue =
    project.goal_completion_date &&
    new Date(project.goal_completion_date) < new Date() &&
    project.current_status?.name !== 'Invoiced';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Hero Header */}
      <ProjectHeader
        project={{
          ...project,
          client_portal_views: (project as { client_portal_views?: number }).client_portal_views,
          schedule_status: (project as { schedule_status?: string }).schedule_status as import('@/types/calendar').BookingStatus | null | undefined,
        }}
        statuses={statuses}
        projectTypeStatuses={projectTypeStatuses}
        isOverdue={!!isOverdue}
        isAdmin={isAdmin}
      />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
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
        </div>

        {/* Sidebar */}
        <div className="space-y-4 md:space-y-6">
          {/* Quick Info - Enhanced with Blue Accent */}
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-background">
            <CardHeader className="bg-primary/10 pb-4 border-b border-primary/10">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-primary/10">
                {/* Goal Date - Always show */}
                <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center',
                        isOverdue ? 'bg-destructive/10' : 'bg-primary/10'
                      )}
                    >
                      <Calendar
                        className={cn(
                          'h-4 w-4',
                          isOverdue ? 'text-destructive' : 'text-primary'
                        )}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">Goal Date</span>
                  </div>
                  {project.goal_completion_date ? (
                    <span
                      className={cn('font-medium', isOverdue && 'text-destructive')}
                    >
                      {format(new Date(project.goal_completion_date), 'MMM d, yyyy')}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not set</span>
                  )}
                </div>

                {/* Schedule Status - No bottom border (removed line) */}
                <div className="p-4 hover:bg-primary/5 transition-colors border-b-0">
                  {canEditSchedule ? (
                    <ProjectScheduleStatus
                      projectId={project.id}
                      currentStatus={(project as { schedule_status?: string }).schedule_status as BookingStatus | null}
                      hasProjectDates={hasProjectDates}
                    />
                  ) : (
                    <ProjectScheduleStatusDisplay
                      status={(project as { schedule_status?: string }).schedule_status as BookingStatus | null}
                      hasProjectDates={hasProjectDates}
                    />
                  )}
                </div>

                {/* Project Dates - Always show */}
                <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Project Dates</span>
                  </div>
                  {project.start_date && project.end_date ? (
                    <span className="font-medium text-sm">
                      {format(new Date(project.start_date), 'MMM d')} - {format(new Date(project.end_date), 'MMM d, yyyy')}
                    </span>
                  ) : project.start_date ? (
                    <span className="font-medium text-sm">
                      Starts {format(new Date(project.start_date), 'MMM d, yyyy')}
                    </span>
                  ) : project.end_date ? (
                    <span className="font-medium text-sm">
                      Ends {format(new Date(project.end_date), 'MMM d, yyyy')}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not set</span>
                  )}
                </div>

                {/* Sales Amount */}
                <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Sales Amount</span>
                  </div>
                  {project.sales_amount ? (
                    <span className="text-lg font-semibold tabular-nums">
                      ${project.sales_amount.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not set</span>
                  )}
                </div>

                {/* Salesperson */}
                {project.salesperson && (
                  <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">Salesperson</span>
                    </div>
                    <span className="font-medium">
                      {project.salesperson.full_name || project.salesperson.email}
                    </span>
                  </div>
                )}

                {/* POC Info */}
                {project.poc_name && (
                  <div className="p-4 hover:bg-primary/5 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">Point of Contact</span>
                    </div>
                    <div className="ml-11 space-y-1">
                      <p className="font-medium">{project.poc_name}</p>
                      {project.poc_email && (
                        <a
                          href={`mailto:${project.poc_email}`}
                          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {project.poc_email}
                        </a>
                      )}
                      {project.poc_phone && (
                        <a
                          href={`tel:${project.poc_phone}`}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {project.poc_phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Links */}
                {(project.sales_order_url || project.scope_link) && (
                  <div className="p-4 space-y-2 bg-primary/5">
                    {project.sales_order_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start hover:bg-primary/10 hover:border-primary/30 border-primary/20"
                        asChild
                      >
                        <a
                          href={project.sales_order_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Sales Order ({project.sales_order_number || 'View'})
                        </a>
                      </Button>
                    )}
                    {project.scope_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start hover:bg-primary/10 hover:border-primary/30 border-primary/20"
                        asChild
                      >
                        <a
                          href={project.scope_link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Scope Document
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
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
      </div>
    </div>
  );
}
