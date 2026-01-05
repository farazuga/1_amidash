import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getProjectBySalesOrder } from '@/lib/data/cached-queries';
import { ProjectFilesClient } from './client';
import { getProjectFiles } from './actions';

export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ salesOrder: string }>;
}) {
  const { salesOrder } = await params;

  const project = await getProjectBySalesOrder(salesOrder);

  if (!project) {
    notFound();
  }

  // Get initial file data - wrapped in try-catch to handle re-render failures gracefully
  let filesResult;
  try {
    filesResult = await getProjectFiles(project.id);
  } catch (error) {
    console.error('Failed to load project files:', error);
    filesResult = { files: [], counts: [], connection: null, globalSharePointConfigured: false };
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${salesOrder}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.client_name}</h1>
          <p className="text-muted-foreground">Project Files</p>
        </div>
      </div>

      {/* Files Browser */}
      <Suspense fallback={<FilesLoadingSkeleton />}>
        <ProjectFilesClient
          projectId={project.id}
          projectName={project.client_name}
          initialFiles={filesResult.files || []}
          initialCounts={filesResult.counts || []}
          initialConnection={filesResult.connection || null}
          globalSharePointConfigured={filesResult.globalSharePointConfigured ?? false}
        />
      </Suspense>
    </div>
  );
}

function FilesLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border overflow-hidden">
              <Skeleton className="aspect-[4/3]" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
