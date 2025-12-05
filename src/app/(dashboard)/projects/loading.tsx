import { ProjectsTableSkeleton } from '@/components/skeletons';

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-5 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>

      <ProjectsTableSkeleton rows={8} />
    </div>
  );
}
