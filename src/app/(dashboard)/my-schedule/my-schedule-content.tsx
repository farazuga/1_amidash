'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useUserSchedule } from '@/hooks/queries/use-assignments';
import { format, addMonths } from 'date-fns';
import { Loader2, Calendar, Info } from 'lucide-react';
import Link from 'next/link';
import type { UserScheduleResult } from '@/types/calendar';

interface MyScheduleContentProps {
  userId: string;
  userName?: string;
}

interface GroupedAssignment {
  assignmentId: string;
  projectId: string;
  projectName: string;
  salesOrderNumber: string | null;
  dates: string[];
  startTime: string;
  endTime: string;
}

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return format(new Date(dates[0] + 'T00:00:00'), 'EEE, MMM d, yyyy');
  const first = format(new Date(dates[0] + 'T00:00:00'), 'EEE, MMM d');
  const last = format(new Date(dates[dates.length - 1] + 'T00:00:00'), 'EEE, MMM d, yyyy');
  return `${first} – ${last}`;
}

function formatTime(time: string): string {
  // time is "HH:MM:SS" or "HH:MM", convert to readable format
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function MyScheduleContent({ userId }: MyScheduleContentProps) {
  const today = useMemo(() => new Date(), []);
  const threeMonthsOut = useMemo(() => addMonths(today, 3), [today]);

  const { data: schedule, isLoading } = useUserSchedule(userId, today, threeMonthsOut);

  // Filter to confirmed only and group by assignment
  const groupedAssignments = useMemo(() => {
    if (!schedule) return [];

    const confirmed = schedule.filter(
      (item) => item.booking_status === 'confirmed'
    );

    // Group by assignment_id
    const byAssignment = new Map<string, GroupedAssignment>();
    confirmed.forEach((item: UserScheduleResult) => {
      const existing = byAssignment.get(item.assignment_id);
      if (existing) {
        existing.dates.push(item.schedule_date);
      } else {
        byAssignment.set(item.assignment_id, {
          assignmentId: item.assignment_id,
          projectId: item.project_id,
          projectName: item.project_name,
          salesOrderNumber: item.sales_order_number,
          dates: [item.schedule_date],
          startTime: item.start_time,
          endTime: item.end_time,
        });
      }
    });

    // Sort dates within each group and sort groups by earliest date
    const result = Array.from(byAssignment.values());
    result.forEach((g) => g.dates.sort());
    result.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
    return result;
  }, [schedule]);

  // Get unique project IDs for team member lookup
  const projectIds = useMemo(
    () => [...new Set(groupedAssignments.map((a) => a.projectId))],
    [groupedAssignments]
  );

  // Fetch team members for confirmed projects
  const supabase = useMemo(() => createClient(), []);
  const { data: teamMembers } = useQuery({
    queryKey: ['my-schedule-team-members', ...projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return {};

      const { data, error } = await supabase
        .from('project_assignments')
        .select('project_id, user_id, profiles!project_assignments_user_id_fkey(full_name)')
        .in('project_id', projectIds)
        .eq('booking_status', 'confirmed')
        .neq('user_id', userId);

      if (error) throw error;

      // Group by project_id
      const result: Record<string, string[]> = {};
      data?.forEach((row) => {
        const pid = row.project_id;
        const name = (row.profiles as { full_name: string | null } | null)?.full_name;
        if (name) {
          if (!result[pid]) result[pid] = [];
          if (!result[pid].includes(name)) {
            result[pid].push(name);
          }
        }
      });
      return result;
    },
    enabled: projectIds.length > 0,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Outlook note */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Your confirmed assignments are also on your Outlook calendar.</span>
      </div>

      {groupedAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium">No upcoming confirmed assignments</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Confirmed assignments will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedAssignments.map((assignment) => {
            const members = teamMembers?.[assignment.projectId] || [];
            const href = assignment.salesOrderNumber
              ? `/projects/${assignment.salesOrderNumber}/calendar`
              : '#';

            return (
              <Link key={assignment.assignmentId} href={href} className="block">
                <div className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{assignment.projectName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(assignment.dates)}
                      {assignment.dates.length > 1 && (
                        <span className="ml-1 text-xs">({assignment.dates.length} days)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(assignment.startTime)} - {formatTime(assignment.endTime)}
                    </p>
                    {members.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Team: {members.join(', ')}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 shrink-0"
                  >
                    Confirmed
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
