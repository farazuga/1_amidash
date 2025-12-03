import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProjectsTable } from '@/components/projects/projects-table';
import { FilterBar } from '@/components/projects/filter-bar';

interface SearchParams {
  search?: string;
  status?: string;
  contract_type?: string;
  overdue?: string;
  sort_by?: string;
  sort_order?: string;
}

async function getProjects(searchParams: SearchParams) {
  const supabase = await createClient();

  let query = supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*),
      tags:project_tags(tag:tags(*))
    `);

  // Apply search
  if (searchParams.search) {
    query = query.or(
      `client_name.ilike.%${searchParams.search}%,` +
      `sales_order_number.ilike.%${searchParams.search}%,` +
      `po_number.ilike.%${searchParams.search}%,` +
      `poc_name.ilike.%${searchParams.search}%`
    );
  }

  // Apply status filter
  if (searchParams.status) {
    query = query.eq('current_status_id', searchParams.status);
  }

  // Apply contract type filter
  if (searchParams.contract_type) {
    query = query.eq('contract_type', searchParams.contract_type);
  }

  // Apply overdue filter
  if (searchParams.overdue === 'true') {
    const today = new Date().toISOString().split('T')[0];
    query = query.lt('goal_completion_date', today);
  }

  // Apply sorting
  const sortBy = searchParams.sort_by || 'created_date';
  const sortOrder = searchParams.sort_order === 'asc' ? true : false;
  query = query.order(sortBy, { ascending: sortOrder });

  const { data: projects, error } = await query;

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return projects || [];
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

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [projects, statuses] = await Promise.all([
    getProjects(params),
    getStatuses(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track all your projects
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <FilterBar statuses={statuses} />

      <Suspense fallback={<div>Loading projects...</div>}>
        <ProjectsTable projects={projects} statuses={statuses} />
      </Suspense>
    </div>
  );
}
