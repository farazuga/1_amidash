import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import type { ScheduleData, GanttAssignment, Profile } from '../../types/database.js';
import { addDays, format, parseISO, isWithinInterval } from 'date-fns';

/**
 * Fetch schedule data for the team schedule slide.
 * Note: This requires the project_assignments table from the calendar feature.
 * If that table doesn't exist, it falls back to using project start/end dates.
 */
export async function fetchScheduleData(daysToShow: number = 14): Promise<ScheduleData> {
  const supabase = getSupabaseClient();
  const today = new Date();
  const startDate = format(today, 'yyyy-MM-dd');
  const endDate = format(addDays(today, daysToShow), 'yyyy-MM-dd');

  try {
    // First, try to fetch from project_assignments table (if calendar feature exists)
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('project_assignments')
      .select(`
        id,
        project_id,
        user_id,
        start_date,
        end_date,
        booking_status,
        notes,
        project:projects(id, client_name, sales_amount),
        user:profiles(id, full_name, email)
      `)
      .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
      .order('start_date');

    if (!assignmentsError && assignmentsData && assignmentsData.length > 0) {
      // Calendar feature exists, use assignment data
      const assignments: GanttAssignment[] = assignmentsData.map((a) => ({
        id: a.id,
        project_id: a.project_id,
        user_id: a.user_id,
        project_name: (a.project as unknown as { client_name: string } | null)?.client_name || 'Unknown',
        user_name: (a.user as unknown as { full_name: string | null } | null)?.full_name || 'Unknown',
        start_date: a.start_date,
        end_date: a.end_date,
        booking_status: a.booking_status as 'pencil' | 'pending_confirm' | 'confirmed',
        days: [], // Assignment days would be fetched separately if needed
      }));

      // Get unique users
      const userMap = new Map<string, Profile>();
      assignmentsData.forEach((a) => {
        const user = a.user as unknown as { id: string; full_name: string | null; email: string } | null;
        if (user && !userMap.has(user.id)) {
          userMap.set(user.id, {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            is_salesperson: null,
          });
        }
      });

      logger.info(
        { assignmentCount: assignments.length, userCount: userMap.size },
        'Fetched schedule data from assignments'
      );

      return {
        assignments,
        users: Array.from(userMap.values()),
      };
    }

    // Fallback: Use project start/end dates if calendar feature doesn't exist
    logger.info('project_assignments table not found, falling back to project dates');

    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        client_name,
        start_date,
        end_date,
        salesperson_id,
        salesperson:profiles!projects_salesperson_id_fkey(id, full_name, email)
      `)
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)
      .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
      .order('start_date');

    if (projectsError) {
      logger.error({ error: projectsError }, 'Failed to fetch projects for schedule');
      throw projectsError;
    }

    // Convert projects to gantt-like format
    const assignments: GanttAssignment[] = (projectsData || [])
      .filter((p) => p.start_date && p.end_date)
      .map((p) => ({
        id: p.id,
        project_id: p.id,
        user_id: p.salesperson_id || 'unassigned',
        project_name: p.client_name,
        user_name: (p.salesperson as unknown as { full_name: string | null } | null)?.full_name || 'Unassigned',
        start_date: p.start_date!,
        end_date: p.end_date!,
        booking_status: 'confirmed' as const,
        days: [],
      }));

    // Get unique users
    const userMap = new Map<string, Profile>();
    projectsData?.forEach((p) => {
      const user = p.salesperson as unknown as { id: string; full_name: string | null; email: string } | null;
      if (user && !userMap.has(user.id)) {
        userMap.set(user.id, {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          is_salesperson: true,
        });
      }
    });

    logger.info(
      { projectCount: assignments.length, userCount: userMap.size },
      'Fetched schedule data from project dates'
    );

    return {
      assignments,
      users: Array.from(userMap.values()),
    };
  } catch (error) {
    logger.error({ error }, 'Exception fetching schedule data');
    throw error;
  }
}

/**
 * Get assignable users (for the schedule display)
 */
export async function fetchAssignableUsers(): Promise<Profile[]> {
  const supabase = getSupabaseClient();

  try {
    // Try to fetch users with is_assignable flag first
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, is_salesperson, is_assignable')
      .or('is_assignable.eq.true,is_salesperson.eq.true')
      .order('full_name');

    if (error) {
      logger.error({ error }, 'Failed to fetch assignable users');
      throw error;
    }

    return (data || []) as unknown as Profile[];
  } catch (error) {
    logger.error({ error }, 'Exception fetching assignable users');
    throw error;
  }
}

/**
 * Check if a date falls within a date range
 */
export function isDateInRange(date: Date, startDate: string, endDate: string): boolean {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return isWithinInterval(date, { start, end });
}

/**
 * Generate date range array
 */
export function generateDateRange(startDate: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(startDate, i));
  }
  return dates;
}
