'use client';

import { ProjectCalendar } from '@/components/calendar/project-calendar';
import type { Project } from '@/types';

interface ProjectCalendarContentProps {
  project: Project;
  isAdmin: boolean;
}

export function ProjectCalendarContent({ project, isAdmin }: ProjectCalendarContentProps) {
  return (
    <ProjectCalendar
      project={project}
      enableDragDrop={isAdmin}
    />
  );
}
