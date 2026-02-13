'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

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
  salesOrder?: string;
  isOverdue?: boolean;
}

export function ProjectHeader({
  project,
  salesOrder,
  isOverdue = false,
}: ProjectHeaderProps) {
  const [navList, setNavList] = useState<string[] | null>(null);

  useEffect(() => {
    if (!salesOrder) return;
    try {
      const stored = sessionStorage.getItem('projects-nav-list');
      if (stored) {
        setNavList(JSON.parse(stored));
      }
    } catch {
      // sessionStorage not available
    }
  }, [salesOrder]);

  const currentIndex = navList && salesOrder ? navList.indexOf(salesOrder) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = navList !== null && currentIndex >= 0 && currentIndex < navList.length - 1;
  const showNav = navList !== null && currentIndex >= 0;

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

        {/* Prev/Next Navigation */}
        {showNav && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!hasPrev}
              asChild={hasPrev}
            >
              {hasPrev ? (
                <Link href={`/projects/${navList![currentIndex - 1]}`}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              ) : (
                <span><ChevronLeft className="h-4 w-4" /></span>
              )}
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
              {currentIndex + 1} of {navList!.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!hasNext}
              asChild={hasNext}
            >
              {hasNext ? (
                <Link href={`/projects/${navList![currentIndex + 1]}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span><ChevronRight className="h-4 w-4" /></span>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
