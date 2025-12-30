'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ExternalLink,
  MoreHorizontal,
  ArrowUpDown,
  Copy,
  Eye,
  Trash2,
  Globe,
  Settings2,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './status-badge';
import { ScheduleStatusBadge } from './schedule-status-badge';
import { toast } from 'sonner';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/types/calendar';

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
  defaultWidth: number;
  minWidth: number;
  sortable: boolean;
  sortKey?: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'client', label: 'Client', defaultVisible: true, defaultWidth: 200, minWidth: 120, sortable: true, sortKey: 'client_name' },
  { id: 'created_date', label: 'Created Date', defaultVisible: true, defaultWidth: 120, minWidth: 100, sortable: true, sortKey: 'created_date' },
  { id: 'status', label: 'Status', defaultVisible: true, defaultWidth: 130, minWidth: 100, sortable: true, sortKey: 'status' },
  { id: 'schedule_status', label: 'Schedule Status', defaultVisible: false, defaultWidth: 140, minWidth: 100, sortable: false },
  { id: 'engineers', label: 'Engineers', defaultVisible: false, defaultWidth: 180, minWidth: 100, sortable: false },
  { id: 'project_dates', label: 'Project Dates', defaultVisible: false, defaultWidth: 160, minWidth: 120, sortable: true, sortKey: 'start_date' },
  { id: 'amount', label: 'Amount', defaultVisible: true, defaultWidth: 100, minWidth: 80, sortable: true, sortKey: 'sales_amount' },
  { id: 'goal_date', label: 'Goal Date', defaultVisible: true, defaultWidth: 120, minWidth: 100, sortable: true, sortKey: 'goal_completion_date' },
  { id: 'sales_order', label: 'Sales Order', defaultVisible: true, defaultWidth: 120, minWidth: 80, sortable: false },
  { id: 'poc', label: 'POC', defaultVisible: true, defaultWidth: 150, minWidth: 100, sortable: false },
  { id: 'client_portal', label: 'Client Portal', defaultVisible: true, defaultWidth: 100, minWidth: 80, sortable: false },
];

const STORAGE_KEY = 'projects-table-columns';

interface ColumnPreferences {
  visibility: Record<string, boolean>;
  widths: Record<string, number>;
}

function getDefaultPreferences(): ColumnPreferences {
  return {
    visibility: COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {}),
    widths: COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultWidth }), {}),
  };
}

function loadPreferences(): ColumnPreferences {
  if (typeof window === 'undefined') return getDefaultPreferences();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new columns
      const defaults = getDefaultPreferences();
      return {
        visibility: { ...defaults.visibility, ...parsed.visibility },
        widths: { ...defaults.widths, ...parsed.widths },
      };
    }
  } catch (e) {
    console.error('Failed to load column preferences:', e);
  }
  return getDefaultPreferences();
}

function savePreferences(prefs: ColumnPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save column preferences:', e);
  }
}

interface ProjectWithTags {
  id: string;
  client_name: string;
  created_date: string;
  sales_order_number: string | null;
  sales_order_url: string | null;
  po_number: string | null;
  sales_amount: number | null;
  contract_type: string | null;
  goal_completion_date: string | null;
  current_status_id: string | null;
  poc_name: string | null;
  poc_email: string | null;
  scope_link: string | null;
  client_token: string | null;
  client_portal_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  schedule_status?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  current_status?: any;
  tags?: { tag: { id: string; name: string; color: string | null } }[];
  assignments?: { id: string; user: { id: string; full_name: string | null } | null }[];
}

interface ProjectsTableProps {
  projects: ProjectWithTags[];
}

export function ProjectsTable({ projects }: ProjectsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useUser();
  const supabase = createClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithTags | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Column preferences state
  const [preferences, setPreferences] = useState<ColumnPreferences>(getDefaultPreferences);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  // Save preferences when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      savePreferences(preferences);
    }
  }, [preferences]);

  const visibleColumns = COLUMNS.filter(col => preferences.visibility[col.id]);

  const handleSort = (column: string) => {
    const col = COLUMNS.find(c => c.id === column);
    if (!col?.sortable || !col.sortKey) return;

    const params = new URLSearchParams(searchParams.toString());
    const currentSort = params.get('sort_by');
    const currentOrder = params.get('sort_order');

    if (currentSort === col.sortKey) {
      params.set('sort_order', currentOrder === 'asc' ? 'desc' : 'asc');
    } else {
      params.set('sort_by', col.sortKey);
      params.set('sort_order', 'desc');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleColumn = (columnId: string) => {
    setPreferences(prev => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        [columnId]: !prev.visibility[columnId],
      },
    }));
  };

  const resetPreferences = () => {
    setPreferences(getDefaultPreferences());
    toast.success('Column preferences reset');
  };

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizingColumn(columnId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = preferences.widths[columnId];
  }, [preferences.widths]);

  useEffect(() => {
    if (!isResizing || !resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const column = COLUMNS.find(c => c.id === resizingColumn);
      const newWidth = Math.max(column?.minWidth || 50, resizeStartWidth.current + delta);

      setPreferences(prev => ({
        ...prev,
        widths: {
          ...prev.widths,
          [resizingColumn]: newWidth,
        },
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizingColumn]);

  const copyClientPortalLink = (token: string) => {
    const url = `${window.location.origin}/status/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Client portal link copied to clipboard');
  };

  const isOverdue = (goalDate: string | null) => {
    if (!goalDate) return false;
    return new Date(goalDate) < new Date();
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      // Log deletion to audit before deleting
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        project_id: projectToDelete.id,
        user_id: user?.id,
        action: 'delete',
        field_name: 'project',
        old_value: projectToDelete.client_name,
      });

      // Delete the project (cascades to project_tags, status_history)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);

      if (error) {
        toast.error('Failed to delete project');
        console.error('Delete error:', error);
        return;
      }

      toast.success('Project deleted successfully');
      router.refresh();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const renderCell = (project: ProjectWithTags, columnId: string) => {
    switch (columnId) {
      case 'client':
        return (
          <div className="space-y-1">
            <p className="font-medium">{project.client_name}</p>
            {project.tags && project.tags.length > 0 && (
              <div className="flex gap-1">
                {project.tags.slice(0, 2).map(({ tag }) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: tag.color ?? '#888888', color: tag.color ?? '#888888' }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {project.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{project.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        );

      case 'created_date':
        return format(new Date(project.created_date), 'MMM d, yyyy');

      case 'status':
        return <StatusBadge status={project.current_status} />;

      case 'schedule_status':
        return (
          <ScheduleStatusBadge
            status={project.schedule_status as BookingStatus | null}
            size="sm"
          />
        );

      case 'engineers':
        if (!project.assignments || project.assignments.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        const engineers = project.assignments
          .map(a => a.user?.full_name)
          .filter(Boolean);
        if (engineers.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return (
          <div className="space-y-0.5">
            {engineers.slice(0, 2).map((name, i) => (
              <div key={i} className="text-sm truncate">{name}</div>
            ))}
            {engineers.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{engineers.length - 2} more
              </span>
            )}
          </div>
        );

      case 'project_dates':
        if (!project.start_date && !project.end_date) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return (
          <div className="text-sm">
            {project.start_date && format(new Date(project.start_date), 'MMM d')}
            {project.start_date && project.end_date && ' – '}
            {project.end_date && format(new Date(project.end_date), 'MMM d')}
          </div>
        );

      case 'amount':
        return project.sales_amount
          ? `$${project.sales_amount.toLocaleString()}`
          : '-';

      case 'goal_date':
        return project.goal_completion_date ? (
          <span
            className={
              isOverdue(project.goal_completion_date) &&
              project.current_status?.name !== 'Invoiced'
                ? 'text-destructive font-medium'
                : ''
            }
          >
            {format(new Date(project.goal_completion_date), 'MMM d, yyyy')}
          </span>
        ) : (
          '-'
        );

      case 'sales_order':
        return project.sales_order_url ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={(e) => {
              e.stopPropagation();
              window.open(project.sales_order_url!, '_blank');
            }}
          >
            {project.sales_order_number || 'View'}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        ) : (
          project.sales_order_number || '-'
        );

      case 'poc':
        return (
          <div className="text-sm">
            <p>{project.poc_name || '-'}</p>
            {project.poc_email && (
              <p className="text-muted-foreground text-xs">
                {project.poc_email}
              </p>
            )}
          </div>
        );

      case 'client_portal':
        return project.client_token ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/status/${project.client_token}`, '_blank');
            }}
            title="Open Client Portal"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );

      default:
        return null;
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 px-4">
        <p className="text-base sm:text-lg font-medium text-muted-foreground">
          No projects found
        </p>
        <p className="text-sm text-muted-foreground text-center">
          Try adjusting your filters or create a new project
        </p>
        <Button asChild className="mt-4">
          <Link href="/projects/new">Create Project</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-lg border bg-card p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            {/* Header with Client and Actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{project.client_name}</h3>
                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {project.tags.slice(0, 3).map(({ tag }) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: tag.color ?? '#888888', color: tag.color ?? '#888888' }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {project.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{project.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/projects/${project.id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  {project.client_token && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        copyClientPortalLink(project.client_token!);
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Client Link
                    </DropdownMenuItem>
                  )}
                  {project.scope_link && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(project.scope_link!, '_blank');
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Scope
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Project
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <StatusBadge status={project.current_status} />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">Created Date</span>
                <span className="font-medium">
                  {format(new Date(project.created_date), 'MMM d, yyyy')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Amount</span>
                <span className="font-medium">
                  {project.sales_amount ? `$${project.sales_amount.toLocaleString()}` : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Goal Date</span>
                <span
                  className={
                    isOverdue(project.goal_completion_date) &&
                    project.current_status?.name !== 'Invoiced'
                      ? 'text-destructive font-medium'
                      : 'font-medium'
                  }
                >
                  {project.goal_completion_date
                    ? format(new Date(project.goal_completion_date), 'MMM d, yyyy')
                    : '-'}
                </span>
              </div>
              {project.poc_name && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs block">POC</span>
                  <span className="font-medium">{project.poc_name}</span>
                  {project.poc_email && (
                    <span className="text-muted-foreground text-xs block truncate">
                      {project.poc_email}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {project.sales_order_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(project.sales_order_url!, '_blank');
                  }}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Sales Order
                </Button>
              )}
              {project.client_portal_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(project.client_portal_url!, '_blank');
                  }}
                >
                  <Globe className="mr-1 h-3 w-3" />
                  Portal
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block space-y-2">
        {/* Column Settings */}
        <div className="flex justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Toggle Columns</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetPreferences}
                    className="h-8 px-2 text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
                <div className="space-y-2">
                  {COLUMNS.map((column) => (
                    <div key={column.id} className="flex items-center gap-2">
                      <Checkbox
                        id={column.id}
                        checked={preferences.visibility[column.id]}
                        onCheckedChange={() => toggleColumn(column.id)}
                      />
                      <label
                        htmlFor={column.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {column.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Table */}
        <div
          className={cn(
            'rounded-lg border overflow-x-auto',
            isResizing && 'select-none'
          )}
        >
          <Table style={{ tableLayout: 'fixed', width: 'auto', minWidth: '100%' }}>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.id}
                    className="relative group"
                    style={{ width: preferences.widths[column.id] }}
                  >
                    <div className="flex items-center">
                      {column.sortable ? (
                        <Button
                          variant="ghost"
                          onClick={() => handleSort(column.id)}
                          className="h-8 px-2 -ml-2"
                        >
                          {column.label}
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="px-2">{column.label}</span>
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      className={cn(
                        'absolute right-0 top-0 h-full w-1 cursor-col-resize',
                        'opacity-0 group-hover:opacity-100 hover:bg-primary/50',
                        'transition-opacity',
                        resizingColumn === column.id && 'opacity-100 bg-primary'
                      )}
                      onMouseDown={(e) => handleResizeStart(e, column.id)}
                    />
                  </TableHead>
                ))}
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      style={{ width: preferences.widths[column.id] }}
                    >
                      {renderCell(project, column.id)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${project.id}`);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {project.client_token && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              copyClientPortalLink(project.client_token!);
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Client Link
                          </DropdownMenuItem>
                        )}
                        {project.scope_link && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(project.scope_link!, '_blank');
                            }}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Scope
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(project);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Project
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.client_name}&quot;? This action cannot be undone.
              The project and all related data (status history, tags) will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
