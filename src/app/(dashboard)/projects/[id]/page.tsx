import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/projects/status-badge';
import { ProjectForm } from '@/components/projects/project-form';
import { StatusHistory } from '@/components/projects/status-history';
import { StatusChangeButton } from '@/components/projects/status-change-button';
import { CopyClientLink } from '@/components/projects/copy-client-link';

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
  const [project, statuses, tags, statusHistory, salespeople, projectTypes, projectTypeStatuses] = await Promise.all([
    getProject(id),
    getStatuses(),
    getTags(),
    getStatusHistory(id),
    getSalespeople(),
    getProjectTypes(),
    getProjectTypeStatuses(),
  ]);

  if (!project) {
    notFound();
  }

  const isOverdue =
    project.goal_completion_date &&
    new Date(project.goal_completion_date) < new Date() &&
    project.current_status?.name !== 'Invoiced';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {project.client_name}
              </h1>
              <StatusBadge status={project.current_status} />
              {isOverdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Created {format(new Date(project.created_at), 'MMM d, yyyy')}
              {project.created_by_profile &&
                ` by ${project.created_by_profile.full_name || project.created_by_profile.email}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyClientLink token={project.client_token} />
          <StatusChangeButton
            projectId={project.id}
            currentStatusId={project.current_status_id}
            statuses={statuses}
            pocEmail={project.poc_email}
            clientName={project.client_name}
            projectTypeId={project.project_type_id}
            projectTypeStatuses={projectTypeStatuses}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>Edit project details below</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectForm
                project={project}
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
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.sales_amount && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Sales Amount</p>
                    <p className="font-semibold text-lg">
                      ${project.sales_amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {project.goal_completion_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Goal Date</p>
                    <p className={`font-semibold ${isOverdue ? 'text-destructive' : ''}`}>
                      {format(new Date(project.goal_completion_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {project.contract_type && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Type</p>
                    <p className="font-medium">{project.contract_type}</p>
                  </div>
                </div>
              )}

              {project.salesperson && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Salesperson</p>
                    <p className="font-medium">
                      {project.salesperson.full_name || project.salesperson.email}
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {/* POC Info */}
              {project.poc_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Point of Contact
                  </p>
                  <p className="font-medium">{project.poc_name}</p>
                  {project.poc_email && (
                    <a
                      href={`mailto:${project.poc_email}`}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {project.poc_email}
                    </a>
                  )}
                  {project.poc_phone && (
                    <a
                      href={`tel:${project.poc_phone}`}
                      className="flex items-center gap-1 text-sm text-muted-foreground"
                    >
                      <Phone className="h-3 w-3" />
                      {project.poc_phone}
                    </a>
                  )}
                </div>
              )}

              <Separator />

              {/* Links */}
              <div className="space-y-2">
                {project.sales_order_url && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
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
                  <Button variant="outline" size="sm" className="w-full" asChild>
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
