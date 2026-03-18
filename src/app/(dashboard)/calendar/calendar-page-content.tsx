'use client';

import { useState, useCallback, useMemo } from 'react';
import { ProjectCalendar } from '@/components/calendar';
import type { ExternalCalendarFilters } from '@/components/calendar';
import type { CalendarEvent, BookingStatus } from '@/types/calendar';
import type { Project } from '@/types';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface CalendarPageContentProps {
  isAdmin: boolean;
  initialProject?: Project | null;
}

export function CalendarPageContent({ isAdmin, initialProject }: CalendarPageContentProps) {
  const router = useRouter();
  const project = initialProject ? (initialProject as Project) : undefined;

  // Filter state
  const [showPending, setShowPending] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [engineerFilter, setEngineerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Track events for building filter options
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const handleEventClick = (event: CalendarEvent) => {
    router.push(`/projects/${event.projectId}`);
  };

  const handleEventsLoaded = useCallback((events: CalendarEvent[]) => {
    setCalendarEvents(events);
  }, []);

  // Derive unique projects and engineers from event data
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    calendarEvents.forEach((e) => map.set(e.projectId, e.projectName || e.projectId));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [calendarEvents]);

  const uniqueEngineers = useMemo(() => {
    const map = new Map<string, string>();
    calendarEvents.forEach((e) => map.set(e.userId, e.userName || e.userId));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [calendarEvents]);

  // Build external filters for ProjectCalendar
  const externalFilters = useMemo<ExternalCalendarFilters>(() => ({
    projectFilter: projectFilter !== 'all' ? projectFilter : undefined,
    engineerFilter: engineerFilter !== 'all' ? engineerFilter : undefined,
    statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
    showPending,
  }), [projectFilter, engineerFilter, statusFilter, showPending]);

  // Count active filters for the clear button
  const activeFilterCount = [projectFilter, engineerFilter, statusFilter].filter(f => f !== 'all').length + (showPending ? 0 : 1);

  const clearAllFilters = () => {
    setProjectFilter('all');
    setEngineerFilter('all');
    setStatusFilter('all');
    setShowPending(true);
  };

  return (
    <div className="space-y-4">
      {/* Back to all projects link when viewing a specific project */}
      {project && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/calendar" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to all projects
          </Link>
          <span>·</span>
          <span className="font-medium text-foreground">{project.client_name}</span>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Project filter */}
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {uniqueProjects.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Engineer filter */}
        <Select value={engineerFilter} onValueChange={setEngineerFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Engineers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engineers</SelectItem>
            {uniqueEngineers.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(['draft', 'pending', 'confirmed'] as BookingStatus[]).map((status) => {
              const config = BOOKING_STATUS_CONFIG[status];
              return (
                <SelectItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
                    {config.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Pending toggle */}
        <div className="flex items-center gap-2">
          <Switch id="show-pending" checked={showPending} onCheckedChange={setShowPending} />
          <Label htmlFor="show-pending" className="text-sm text-muted-foreground">Show pending</Label>
        </div>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear filters ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Calendar */}
      <ProjectCalendar
        project={project}
        onEventClick={handleEventClick}
        enableDragDrop={isAdmin && !!project}
        externalFilters={externalFilters}
        onEventsLoaded={handleEventsLoaded}
        isAdminOverride={isAdmin}
      />
    </div>
  );
}
