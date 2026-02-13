'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProjectHeaderProps {
  project: {
    client_name: string;
    created_at: string | null;
    created_date: string | null;
    created_by_profile?: {
      full_name: string | null;
      email: string;
    } | null;
    salesperson?: {
      full_name: string | null;
      email: string;
    } | null;
  };
  isOverdue?: boolean;
}

export function ProjectHeader({
  project,
  isOverdue = false,
}: ProjectHeaderProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border p-4 sm:p-6',
        'bg-gradient-to-br from-primary/5 via-transparent to-accent/5',
        'border-primary/10'
      )}
    >
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="shrink-0 h-10 w-10 hover:bg-primary/10"
        >
          <Link href="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
              {project.client_name}
            </h1>
            {isOverdue && (
              <Badge variant="destructive" className="animate-pulse">
                Overdue
              </Badge>
            )}
          </div>

          {/* Meta info */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Created{' '}
            {project.created_date
              ? format(new Date(project.created_date + 'T00:00:00'), 'MMM d, yyyy')
              : '-'}
            {project.created_by_profile &&
              ` by ${project.created_by_profile.full_name || project.created_by_profile.email}`}
            {project.salesperson &&
              ` • Sales: ${project.salesperson.full_name || project.salesperson.email}`}
          </p>
        </div>
      </div>
    </div>
  );
}
