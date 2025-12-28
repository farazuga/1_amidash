'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Project {
  id: string;
  client_name: string;
  goal_completion_date: string;
  sales_amount: number | null;
  current_status?: {
    name: string;
  } | null;
}

interface OverdueProjectsProps {
  projects: Project[];
}

export function OverdueProjects({ projects }: OverdueProjectsProps) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">Overdue Projects</CardTitle>
        </div>
        <CardDescription>
          Projects past their goal completion date
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {projects.slice(0, 5).map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3"
            >
              <div className="space-y-1">
                <p className="font-medium">{project.client_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Overdue by{' '}
                    {formatDistanceToNow(new Date(project.goal_completion_date))}
                  </span>
                  {project.current_status && (
                    <Badge variant="outline">{project.current_status.name}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {project.sales_amount && (
                  <span className="font-medium">
                    ${project.sales_amount.toLocaleString()}
                  </span>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/projects/${project.id}`}>
                    View
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
          {projects.length > 5 && (
            <Button variant="link" asChild className="w-full">
              <Link href="/projects?overdue=true">
                View all {projects.length} overdue projects
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
