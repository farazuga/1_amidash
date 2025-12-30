import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { ProjectCalendarContent } from './project-calendar-content';
import { ScheduleStatusWithCascade } from './schedule-status-with-cascade';
import type { Project } from '@/types';
import type { BookingStatus } from '@/types/calendar';

async function getProjectBySalesOrder(salesOrder: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id,
      client_name,
      sales_order_number,
      start_date,
      end_date,
      schedule_status
    `)
    .eq('sales_order_number', salesOrder)
    .single();

  return project as (Project & { schedule_status?: string; sales_order_number: string }) | null;
}

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

export default async function ProjectCalendarPage({
  params,
}: {
  params: Promise<{ salesOrder: string }>;
}) {
  const { salesOrder } = await params;
  const [project, user] = await Promise.all([
    getProjectBySalesOrder(salesOrder),
    getCurrentUser(),
  ]);

  if (!project) {
    notFound();
  }

  const isAdmin = user?.role === 'admin';
  const canEditSchedule = user?.role === 'admin' || user?.role === 'editor';
  const hasProjectDates = Boolean(project.start_date && project.end_date);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${project.sales_order_number}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight">
                {project.client_name} - Schedule
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage team assignments for this project
            </p>
          </div>
        </div>

        {canEditSchedule && (
          <ScheduleStatusWithCascade
            projectId={project.id}
            projectName={project.client_name}
            currentStatus={project.schedule_status as BookingStatus | null}
            hasProjectDates={hasProjectDates}
          />
        )}
      </div>

      {/* Project dates info */}
      {(!project.start_date || !project.end_date) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> This project doesn&apos;t have dates set yet.{' '}
            <Link href={`/projects/${project.sales_order_number}`} className="underline hover:no-underline">
              Edit project
            </Link>{' '}
            to set start and end dates before assigning team members.
          </p>
        </div>
      )}

      {/* Calendar with drag-and-drop for admins */}
      <ProjectCalendarContent
        project={project}
        isAdmin={isAdmin}
      />
    </div>
  );
}
