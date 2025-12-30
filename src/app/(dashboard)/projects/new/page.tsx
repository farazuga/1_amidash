import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ProjectForm } from '@/components/projects/project-form';
import {
  getCachedStatuses,
  getCachedTags,
  getCachedProjectTypes,
  getCachedProjectTypeStatuses,
  getCachedSalespeople,
} from '@/lib/data/cached-queries';

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function NewProjectPage() {
  // Use cached queries for static data
  const [statuses, tags, salespeople, projectTypes, projectTypeStatuses, currentUser] = await Promise.all([
    getCachedStatuses(),
    getCachedTags(),
    getCachedSalespeople(),
    getCachedProjectTypes(),
    getCachedProjectTypeStatuses(),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
          <p className="text-muted-foreground">
            Create a new project to track
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Enter the project information below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            statuses={statuses}
            tags={tags}
            salespeople={salespeople}
            projectTypes={projectTypes}
            projectTypeStatuses={projectTypeStatuses}
            currentUserId={currentUser?.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
