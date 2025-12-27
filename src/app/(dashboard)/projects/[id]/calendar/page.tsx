import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { ProjectCalendarContent } from './project-calendar-content';
import type { Project } from '@/types';

async function getProject(id: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id,
      client_name,
      start_date,
      end_date
    `)
    .eq('id', id)
    .single();

  return project as Project | null;
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, user] = await Promise.all([
    getProject(id),
    getCurrentUser(),
  ]);

  if (!project) {
    notFound();
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${id}`}>
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

      {/* Project dates info */}
      {(!project.start_date || !project.end_date) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Note:</strong> This project doesn&apos;t have dates set yet.{' '}
            <Link href={`/projects/${id}`} className="underline hover:no-underline">
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
