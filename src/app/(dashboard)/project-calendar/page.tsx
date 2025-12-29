import { Suspense } from 'react';
import { Metadata } from 'next';
import { ProjectCalendarView } from './project-calendar-view';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Project Calendar',
  description: 'View all projects on a timeline',
};

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-[500px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ProjectCalendarPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Project Calendar</h1>
        <p className="text-muted-foreground mt-1">
          View all projects on a timeline, color-coded by schedule status
        </p>
      </div>
      <Suspense fallback={<LoadingFallback />}>
        <ProjectCalendarView />
      </Suspense>
    </div>
  );
}
