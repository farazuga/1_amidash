'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  isSameDay,
  isWithinInterval,
  addDays,
} from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import { BOOKING_STATUS_CONFIG } from '@/lib/calendar/constants';
import { cn } from '@/lib/utils';
import type { ProjectWithDetails } from './use-projects-with-dates';
import type { BookingStatus } from '@/types/calendar';

// Layout constants
const BAR_HEIGHT = 22;
const BAR_GAP = 4;
const CONTAINER_PADDING = 4;
const MAX_ROWS = 50; // Safety limit to prevent infinite loops

interface ProjectCalendarMonthViewProps {
  projects: ProjectWithDetails[];
  currentMonth: Date;
  onStatusChange?: (projectId: string, currentStatus: BookingStatus) => void;
}

interface ProjectBar {
  project: ProjectWithDetails;
  startIndex: number;
  endIndex: number;
  isStart: boolean;
  isEnd: boolean;
  row: number;
}

export function ProjectCalendarMonthView({
  projects,
  currentMonth,
  onStatusChange,
}: ProjectCalendarMonthViewProps) {
  // Get all weeks in the month (starting Monday)
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachWeekOfInterval(
      { start: calendarStart, end: calendarEnd },
      { weekStartsOn: 1 }
    );
  }, [currentMonth]);

  // Get weekdays (Mon-Fri) for a week
  const getWeekdays = (weekStart: Date) => {
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 4),
    });
  };

  // Calculate project conflicts
  const projectConflicts = useMemo(() => {
    const conflicts = new Map<string, Set<string>>();
    const engineerDateMap = new Map<string, Map<string, string[]>>();

    for (const project of projects) {
      if (!project.start_date || !project.end_date || !project.assignments?.length) continue;

      const start = parseISO(project.start_date);
      const end = parseISO(project.end_date);
      const projectDates = eachDayOfInterval({ start, end }).filter(d => !isWeekend(d));

      for (const assignment of project.assignments) {
        if (!assignment.user_id) continue;

        if (!engineerDateMap.has(assignment.user_id)) {
          engineerDateMap.set(assignment.user_id, new Map());
        }
        const dateMap = engineerDateMap.get(assignment.user_id)!;

        for (const date of projectDates) {
          const dateStr = format(date, 'yyyy-MM-dd');
          if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, []);
          }
          dateMap.get(dateStr)!.push(project.id);
        }
      }
    }

    for (const [, dateMap] of engineerDateMap) {
      for (const [dateStr, projectIds] of dateMap) {
        if (projectIds.length > 1) {
          for (const projectId of projectIds) {
            if (!conflicts.has(projectId)) {
              conflicts.set(projectId, new Set());
            }
            conflicts.get(projectId)!.add(dateStr);
          }
        }
      }
    }

    return conflicts;
  }, [projects]);

  // Pre-calculate bars for all weeks (function moved inside useMemo to fix dependency)
  const weekBars = useMemo(() => {
    const getProjectBarsForWeek = (weekStart: Date): ProjectBar[] => {
      const weekdays = getWeekdays(weekStart);
      const bars: ProjectBar[] = [];
      const rowOccupancy: boolean[][] = Array.from({ length: 5 }, () => []);

      const sortedProjects = [...projects]
        .filter(p => p.start_date && p.end_date)
        .sort((a, b) => {
          const aStart = parseISO(a.start_date!);
          const bStart = parseISO(b.start_date!);
          if (aStart < bStart) return -1;
          if (aStart > bStart) return 1;
          const aDuration = parseISO(a.end_date!).getTime() - aStart.getTime();
          const bDuration = parseISO(b.end_date!).getTime() - bStart.getTime();
          return bDuration - aDuration;
        });

      for (const project of sortedProjects) {
        const projectStart = parseISO(project.start_date!);
        const projectEnd = parseISO(project.end_date!);

        // Find overlap with this week's weekdays
        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i < weekdays.length; i++) {
          const day = weekdays[i];
          if (isWithinInterval(day, { start: projectStart, end: projectEnd })) {
            if (startIndex === -1) startIndex = i;
            endIndex = i;
          }
        }

        if (startIndex === -1) continue;

        // Find available row with safety limit
        let row = 0;
        while (row < MAX_ROWS) {
          let available = true;
          for (let i = startIndex; i <= endIndex; i++) {
            if (rowOccupancy[i][row]) {
              available = false;
              break;
            }
          }
          if (available) break;
          row++;
        }

        // Skip if we hit max rows (shouldn't happen in practice)
        if (row >= MAX_ROWS) {
          console.warn(`Max rows (${MAX_ROWS}) exceeded for project ${project.id}`);
          continue;
        }

        // Mark row as occupied
        for (let i = startIndex; i <= endIndex; i++) {
          rowOccupancy[i][row] = true;
        }

        const isStart = isSameDay(weekdays[startIndex], projectStart);
        const isEnd = isSameDay(weekdays[endIndex], projectEnd);

        bars.push({
          project,
          startIndex,
          endIndex,
          isStart,
          isEnd,
          row,
        });
      }

      return bars;
    };

    return weeks.map(weekStart => getProjectBarsForWeek(weekStart));
  }, [weeks, projects]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-5 bg-muted border-b">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      {weeks.map((weekStart, weekIndex) => {
        const weekdays = getWeekdays(weekStart);
        const bars = weekBars[weekIndex];
        const maxRow = bars.length > 0 ? Math.max(...bars.map(b => b.row)) + 1 : 0;
        const barsHeight = maxRow * (BAR_HEIGHT + BAR_GAP) + CONTAINER_PADDING;

        return (
          <div key={weekIndex} className="border-b last:border-b-0">
            {/* Day numbers row */}
            <div className="grid grid-cols-5">
              {weekdays.map((day, dayIndex) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'p-1 border-r last:border-r-0 min-h-[32px]',
                      !isCurrentMonth && 'bg-muted/30',
                      isTodayDate && 'bg-primary/5'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm w-7 h-7 flex items-center justify-center rounded-full',
                        !isCurrentMonth && 'text-muted-foreground',
                        isTodayDate && 'bg-primary text-primary-foreground font-medium'
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Project bars row */}
            {bars.length > 0 && (
              <div
                className="relative px-1 pb-1"
                style={{ height: `${barsHeight}px` }}
              >
                {bars.map((bar) => {
                  const status = (bar.project.schedule_status as BookingStatus) || 'draft';
                  const config = BOOKING_STATUS_CONFIG[status];
                  const hasConflict = projectConflicts.has(bar.project.id);

                  const left = (bar.startIndex / 5) * 100;
                  const width = ((bar.endIndex - bar.startIndex + 1) / 5) * 100;
                  const top = bar.row * 26;

                  return (
                    <Tooltip key={`${bar.project.id}-${weekIndex}`}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/projects/${bar.project.sales_order_number || bar.project.id}`}
                          className={cn(
                            'absolute h-[22px] flex items-center px-2 text-xs font-medium truncate',
                            'rounded border hover:opacity-80 transition-opacity',
                            config.bgColor,
                            config.borderColor,
                            config.textColor,
                            !bar.isStart && 'rounded-l-none border-l-0 pl-1',
                            !bar.isEnd && 'rounded-r-none border-r-0 pr-1',
                            hasConflict && 'ring-1 ring-amber-500'
                          )}
                          style={{
                            left: `${left}%`,
                            width: `calc(${width}% - 4px)`,
                            top: `${top}px`,
                            marginLeft: '2px',
                          }}
                        >
                          {hasConflict && (
                            <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0 text-amber-600" />
                          )}
                          <span className="truncate">
                            {bar.isStart ? bar.project.client_name : ''}
                          </span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs">
                          <div className="font-medium">{bar.project.client_name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
                            <span>{config.label}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {format(parseISO(bar.project.start_date!), 'MMM d')} –{' '}
                            {format(parseISO(bar.project.end_date!), 'MMM d')}
                          </div>
                          {bar.project.assignments && bar.project.assignments.length > 0 && (
                            <div className="text-muted-foreground mt-1">
                              {bar.project.assignments
                                .map(a => a.user?.full_name)
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Empty spacer if no bars */}
            {bars.length === 0 && (
              <div className="h-8" />
            )}
          </div>
        );
      })}
    </div>
  );
}
