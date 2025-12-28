'use client';

import Link from 'next/link';
import { format } from 'date-fns';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye } from 'lucide-react';

// Minimal project type for customer table display
interface CustomerProject {
  id: string;
  client_name: string;
  created_date: string;
  sales_order_number: string | null;
  goal_completion_date: string | null;
  current_status: {
    id: string;
    name: string;
  } | null;
}

interface CustomerProjectsTableProps {
  projects: CustomerProject[];
}

export function CustomerProjectsTable({ projects }: CustomerProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <p className="text-lg">No projects found</p>
            <p className="text-sm mt-1">
              Projects associated with your email address will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Projects</CardTitle>
        <CardDescription>
          {projects.length} project{projects.length !== 1 ? 's' : ''} found
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead className="w-[80px]">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{project.client_name}</div>
                    {project.sales_order_number && (
                      <div className="text-sm text-muted-foreground">
                        #{project.sales_order_number}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {project.current_status ? (
                    <Badge variant="secondary" className="bg-[#023A2D] text-white">
                      {project.current_status.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.created_date
                    ? format(new Date(project.created_date), 'MMM d, yyyy')
                    : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.goal_completion_date
                    ? format(new Date(project.goal_completion_date), 'MMM d, yyyy')
                    : '-'}
                </TableCell>
                <TableCell>
                  <Link href={`/customer/projects/${project.id}`}>
                    <Button variant="ghost" size="icon" title="View project details">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
