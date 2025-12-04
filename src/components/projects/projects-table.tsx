'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
} from '@/components/ui/dropdown-menu';
import { ExternalLink, MoreHorizontal, ArrowUpDown, Copy, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Status } from '@/types';
import { StatusBadge } from './status-badge';
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
import { useState } from 'react';

interface ProjectWithTags {
  id: string;
  client_name: string;
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
  client_token: string;
  current_status?: Status;
  tags?: { tag: { id: string; name: string; color: string } }[];
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

  const handleSort = (column: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentSort = params.get('sort_by');
    const currentOrder = params.get('sort_order');

    if (currentSort === column) {
      params.set('sort_order', currentOrder === 'asc' ? 'desc' : 'asc');
    } else {
      params.set('sort_by', column);
      params.set('sort_order', 'desc');
    }

    router.push(`${pathname}?${params.toString()}`);
  };

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

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <p className="text-lg font-medium text-muted-foreground">
          No projects found
        </p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or create a new project
        </p>
        <Button asChild className="mt-4">
          <Link href="/projects/new">Create Project</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('client_name')}
                className="h-8 px-2"
              >
                Client
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('sales_amount')}
                className="h-8 px-2"
              >
                Amount
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Contract Type</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('goal_completion_date')}
                className="h-8 px-2"
              >
                Goal Date
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>PO #</TableHead>
            <TableHead>Sales Order</TableHead>
            <TableHead>POC</TableHead>
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
              <TableCell>
                <div className="space-y-1">
                  <p className="font-medium">{project.client_name}</p>
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex gap-1">
                      {project.tags.slice(0, 2).map(({ tag }) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: tag.color, color: tag.color }}
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
              </TableCell>
              <TableCell>
                <StatusBadge status={project.current_status} />
              </TableCell>
              <TableCell>
                {project.sales_amount
                  ? `$${project.sales_amount.toLocaleString()}`
                  : '-'}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {project.contract_type || '-'}
                </span>
              </TableCell>
              <TableCell>
                {project.goal_completion_date ? (
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
                )}
              </TableCell>
              <TableCell>{project.po_number || '-'}</TableCell>
              <TableCell>
                {project.sales_order_url ? (
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
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p>{project.poc_name || '-'}</p>
                  {project.poc_email && (
                    <p className="text-muted-foreground text-xs">
                      {project.poc_email}
                    </p>
                  )}
                </div>
              </TableCell>
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
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        copyClientPortalLink(project.client_token);
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Client Link
                    </DropdownMenuItem>
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
    </div>
  );
}
