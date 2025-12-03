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
  view?: 'active' | 'archived';
}

async function getProjects(searchParams: SearchParams, invoicedStatusId: string | null) {
  const supabase = await createClient();

  let query = supabase
    .from('projects')
    .select(`
      *,
      current_status:statuses(*),
      tags:project_tags(tag:tags(*)),
      salesperson:profiles!projects_salesperson_id_fkey(id, full_name, email)
    `);

  // Apply active/archived filter (default to active)
  const view = searchParams.view || 'active';
  if (invoicedStatusId) {
    if (view === 'active') {
      // Active = NOT invoiced
      query = query.neq('current_status_id', invoicedStatusId);
    } else {
      // Archived = invoiced
      query = query.eq('current_status_id', invoicedStatusId);
    }
  }

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
  const statuses = await getStatuses();

  // Find the "Invoiced" status to filter active vs archived
  const invoicedStatus = statuses.find(s => s.name === 'Invoiced');
  const invoicedStatusId = invoicedStatus?.id || null;

  const projects = await getProjects(params, invoicedStatusId);

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

      <FilterBar statuses={statuses} currentView={params.view || 'active'} />

      <Suspense fallback={<div>Loading projects...</div>}>
        <ProjectsTable projects={projects} statuses={statuses} />
      </Suspense>
    </div>
  );
}
