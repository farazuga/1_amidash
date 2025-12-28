import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProjectsTable } from '@/components/projects/projects-table';
import { FilterBar } from '@/components/projects/filter-bar';

interface SearchParams {
  search?: string;
  statuses?: string; // comma-separated status IDs
  contract_type?: string;
  overdue?: string;
  sort_by?: string;
  sort_order?: string;
  view?: 'active' | 'archived';
  date_type?: 'created' | 'goal';
  date_presets?: string; // comma-separated presets (this_month, q1, etc.)
  date_years?: string; // comma-separated years (2025, 2026, etc.)
}

// Helper to calculate date ranges from presets
function getDateRangesFromPresets(presets: string[], years: string[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  // If years are specified, use them; otherwise use current year for relative presets
  const targetYears = years.length > 0 ? years.map(y => parseInt(y)) : [currentYear];

  presets.forEach(preset => {
    targetYears.forEach(year => {
      switch (preset) {
        case 'this_month':
          if (year === currentYear) {
            const monthStart = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(year, currentMonth + 1, 0).getDate();
            const monthEnd = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            ranges.push({ start: monthStart, end: monthEnd });
          }
          break;
        case 'last_3_months':
          if (year === currentYear) {
            for (let i = 0; i < 3; i++) {
              const targetMonth = currentMonth - i;
              const targetYear = targetMonth < 0 ? year - 1 : year;
              const adjustedMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
              const monthStart = `${targetYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`;
              const lastDay = new Date(targetYear, adjustedMonth + 1, 0).getDate();
              const monthEnd = `${targetYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
              ranges.push({ start: monthStart, end: monthEnd });
            }
          }
          break;
        case 'q1':
          ranges.push({ start: `${year}-01-01`, end: `${year}-03-31` });
          break;
        case 'q2':
          ranges.push({ start: `${year}-04-01`, end: `${year}-06-30` });
          break;
        case 'q3':
          ranges.push({ start: `${year}-07-01`, end: `${year}-09-30` });
          break;
        case 'q4':
          ranges.push({ start: `${year}-10-01`, end: `${year}-12-31` });
          break;
        case 'this_year':
          if (year === currentYear) {
            ranges.push({ start: `${year}-01-01`, end: `${year}-12-31` });
          }
          break;
        case 'last_year':
          if (year === currentYear) {
            ranges.push({ start: `${currentYear - 1}-01-01`, end: `${currentYear - 1}-12-31` });
          }
          break;
      }
    });
  });

  // If only years are selected (no presets), add full year ranges
  if (presets.length === 0 && years.length > 0) {
    years.forEach(year => {
      ranges.push({ start: `${year}-01-01`, end: `${year}-12-31` });
    });
  }

  return ranges;
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

  // Apply status filter (supports multiple statuses)
  if (searchParams.statuses) {
    const statusIds = searchParams.statuses.split(',').filter(Boolean);
    if (statusIds.length > 0) {
      query = query.in('current_status_id', statusIds);
    }
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

  // Apply date range filter using presets and/or years
  if (searchParams.date_type && (searchParams.date_presets || searchParams.date_years)) {
    const dateField = searchParams.date_type === 'created' ? 'created_date' : 'goal_completion_date';
    const presets = searchParams.date_presets?.split(',').filter(Boolean) || [];
    const years = searchParams.date_years?.split(',').filter(Boolean) || [];

    const ranges = getDateRangesFromPresets(presets, years);

    if (ranges.length > 0) {
      // Build OR conditions for all date ranges
      // Find the overall min and max dates for a simpler query
      const allStarts = ranges.map(r => r.start).sort();
      const allEnds = ranges.map(r => r.end).sort().reverse();
      const minDate = allStarts[0];
      const maxDate = allEnds[0];

      query = query.gte(dateField, minDate).lte(dateField, maxDate);
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
