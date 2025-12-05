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
  date_type?: 'created' | 'goal';
  from_month?: string;
  from_year?: string;
  to_month?: string;
  to_year?: string;
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

  // Apply date range filter
  if (searchParams.date_type) {
    const dateField = searchParams.date_type === 'created' ? 'created_date' : 'goal_completion_date';

    // Build from date (first day of the month)
    if (searchParams.from_year) {
      const fromMonth = searchParams.from_month ? parseInt(searchParams.from_month) : 1;
      const fromYear = parseInt(searchParams.from_year);
      const fromDate = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`;
      query = query.gte(dateField, fromDate);
    }

    // Build to date (last day of the month)
    if (searchParams.to_year) {
      const toMonth = searchParams.to_month ? parseInt(searchParams.to_month) : 12;
      const toYear = parseInt(searchParams.to_year);
      // Get last day of the month
      const lastDay = new Date(toYear, toMonth, 0).getDate();
      const toDate = `${toYear}-${String(toMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      query = query.lte(dateField, toDate);
    }
  }

  // Apply sorting
  const sortBy = searchParams.sort_by || 'created_date';
  const sortOrder = searchParams.sort_order === 'asc' ? true : false;

  // Special handling for status sorting - sort by display_order from joined status
  if (sortBy === 'status') {
    query = query.order('current_status(display_order)', { ascending: sortOrder });
  } else {
    query = query.order(sortBy, { ascending: sortOrder });
  }

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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and track all your projects
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <FilterBar statuses={statuses} currentView={params.view || 'active'} />

      <Suspense fallback={<div>Loading projects...</div>}>
        <ProjectsTable projects={projects} />
      </Suspense>
    </div>
  );
}
