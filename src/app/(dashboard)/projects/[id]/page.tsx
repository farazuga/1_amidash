import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileText,
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

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile;
}

async function getProject(id: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*),
      tags:project_tags(tag:tags(*)),
      created_by_profile:profiles!projects_created_by_fkey(*),
      salesperson:profiles!projects_salesperson_id_fkey(*)
    `)
    .eq('id', id)
    .single();

  return project;
}

async function getStatuses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('statuses')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  return data || [];
}

async function getTags() {
  const supabase = await createClient();
  const { data } = await supabase.from('tags').select('*').order('name');
  return data || [];
}

async function getStatusHistory(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('status_history')
    .select(`
      *,
      status:statuses(*),
      changed_by_profile:profiles(*)
    `)
    .eq('project_id', projectId)
    .order('changed_at', { ascending: false });
  return data || [];
}

async function getSalespeople() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_salesperson', true)
    .order('full_name');
  return data || [];
}

async function getProjectTypes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_types')
    .select('*')
    .order('display_order');
  return data || [];
}

async function getProjectTypeStatuses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_type_statuses')
    .select('*');
  return data || [];
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, statuses, tags, statusHistory, salespeople, projectTypes, projectTypeStatuses, currentUser] = await Promise.all([
    getProject(id),
    getStatuses(),
    getTags(),
    getStatusHistory(id),
    getSalespeople(),
    getProjectTypes(),
    getProjectTypeStatuses(),
    getCurrentUser(),
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
          {/* Quick Info - Enhanced */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-b from-muted/50 to-transparent pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {/* Sales Amount */}
                {project.sales_amount && (
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">Sales Amount</span>
                    </div>
                    <span className="text-lg font-semibold tabular-nums">
                      ${project.sales_amount.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Goal Date */}
                {project.goal_completion_date && (
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
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
                    <span
                      className={cn('font-medium', isOverdue && 'text-destructive')}
                    >
                      {format(new Date(project.goal_completion_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}

                {/* Schedule Status */}
                <div className="p-4 hover:bg-muted/30 transition-colors">
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

                {/* Contract Type */}
                {project.contract_type && (
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">Contract Type</span>
                    </div>
                    <span className="font-medium">{project.contract_type}</span>
                  </div>
                )}

                {/* Salesperson */}
                {project.salesperson && (
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
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
                  <div className="p-4 hover:bg-muted/30 transition-colors">
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
                  <div className="p-4 space-y-2">
                    {project.sales_order_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start hover:bg-primary/5 hover:border-primary/30"
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
                        className="w-full justify-start hover:bg-primary/5 hover:border-primary/30"
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
