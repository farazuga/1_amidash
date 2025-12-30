'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/projects/status-badge';
import { ScheduleStatusBadge } from '@/components/projects/schedule-status-badge';
import { StatusChangeButton } from '@/components/projects/status-change-button';
import { CopyClientLink } from '@/components/projects/copy-client-link';
import { DeleteProjectButton } from '@/components/projects/delete-project-button';
import type { BookingStatus } from '@/types/calendar';

interface ProjectHeaderProps {
  project: {
    id: string;
    sales_order_number: string | null;
    client_name: string;
    client_token: string | null;
    client_portal_views?: number;
    created_at: string | null;
    current_status_id: string | null;
    current_status: { name: string } | null;
    schedule_status?: BookingStatus | null;
    poc_email: string | null;
    project_type_id: string | null;
    created_by_profile?: {
      full_name: string | null;
      email: string;
    } | null;
    salesperson?: {
      full_name: string | null;
      email: string;
    } | null;
    goal_completion_date?: string | null;
  };
  statuses: Array<{ id: string; name: string; display_order: number }>;
  projectTypeStatuses: Array<{
    project_type_id: string;
    status_id: string;
    display_order?: number;
  }>;
  isOverdue?: boolean;
  isAdmin?: boolean;
}

export function ProjectHeader({
  project,
  statuses,
  projectTypeStatuses,
  isOverdue = false,
  isAdmin = false,
}: ProjectHeaderProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border p-4 sm:p-6 mb-6',
        'bg-gradient-to-br from-primary/5 via-transparent to-accent/5',
        'border-primary/10'
      )}
    >
      <div className="flex flex-col gap-4">
        {/* Top row: Back button, title, and badges */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="shrink-0 h-10 w-10 hover:bg-primary/10"
          >
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div className="flex-1 min-w-0">
            {/* Title and status badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
                {project.client_name}
              </h1>
            </div>

            {/* Status row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge status={project.current_status} size="md" />
              {project.schedule_status && (
                <ScheduleStatusBadge status={project.schedule_status} size="md" />
              )}
              {isOverdue && (
                <Badge variant="destructive" className="animate-pulse">
                  Overdue
                </Badge>
              )}
            </div>

            {/* Meta info */}
            <p className="text-xs sm:text-sm text-muted-foreground">
              Created{' '}
              {project.created_at
                ? format(new Date(project.created_at), 'MMM d, yyyy')
                : '-'}
              {project.created_by_profile &&
                ` by ${project.created_by_profile.full_name || project.created_by_profile.email}`}
              {project.salesperson &&
                ` • Sales: ${project.salesperson.full_name || project.salesperson.email}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div
          className={cn(
            'flex flex-col sm:flex-row items-stretch sm:items-center gap-2',
            'sm:ml-[52px]' // Align with content (past back button)
          )}
        >
          <div
            className={cn(
              'flex flex-wrap items-center gap-2 p-2 rounded-lg',
              'bg-background/80 backdrop-blur border shadow-sm'
            )}
          >
            <CopyClientLink token={project.client_token} />

            {project.client_token && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground px-3 py-1.5 border rounded-md bg-muted/30">
                <Eye className="h-4 w-4" />
                <span className="tabular-nums">
                  {project.client_portal_views ?? 0} views
                </span>
              </div>
            )}

            <StatusChangeButton
              projectId={project.id}
              currentStatusId={project.current_status_id}
              statuses={statuses}
              pocEmail={project.poc_email}
              clientName={project.client_name}
              clientToken={project.client_token}
              projectTypeId={project.project_type_id}
              projectTypeStatuses={projectTypeStatuses}
            />

            <Button variant="outline" asChild>
              <Link href={`/projects/${project.sales_order_number || project.id}/calendar`}>
                <Calendar className="mr-2 h-4 w-4" />
                Schedule
              </Link>
            </Button>

            {isAdmin && (
              <DeleteProjectButton
                projectId={project.id}
                projectName={project.client_name}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
