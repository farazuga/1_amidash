import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ProjectForm } from '@/components/projects/project-form';

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
    .eq('is_active', true)
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

export default async function NewProjectPage() {
  const [statuses, tags, salespeople, projectTypes, projectTypeStatuses] = await Promise.all([
    getStatuses(),
    getTags(),
    getSalespeople(),
    getProjectTypes(),
    getProjectTypeStatuses(),
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
