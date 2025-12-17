import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import { format, addDays, startOfDay } from 'date-fns';

export interface ScheduleEntry {
  userId: string;
  userName: string;
  assignments: {
    projectId: string;
    projectName: string;
    projectColor: string;
    date: string;
    hours: number;
  }[];
}

export async function fetchScheduleData(daysToShow: number = 14): Promise<ScheduleEntry[]> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, returning mock schedule');
    return getMockSchedule(daysToShow);
  }

  try {
    const startDate = startOfDay(new Date());
    const endDate = addDays(startDate, daysToShow);

    const { data: assignments, error } = await supabase
      .from('project_assignments')
      .select(`
        id,
        user_id,
        project_id,
        users(full_name),
        projects(name, color),
        assignment_days(date, hours)
      `)
      .gte('assignment_days.date', format(startDate, 'yyyy-MM-dd'))
      .lte('assignment_days.date', format(endDate, 'yyyy-MM-dd'));

    if (error) throw error;

    const userMap = new Map<string, ScheduleEntry>();

    (assignments || []).forEach((a: Record<string, unknown>) => {
      const userId = a.user_id as string;
      const userName = (a.users as { full_name: string } | null)?.full_name || 'Unknown';
      const projectId = a.project_id as string;
      const projectName = (a.projects as { name: string } | null)?.name || 'Unknown';
      const projectColor = (a.projects as { color: string } | null)?.color || '#808080';

      if (!userMap.has(userId)) {
        userMap.set(userId, { userId, userName, assignments: [] });
      }

      const days = a.assignment_days as { date: string; hours: number }[] | null;
      (days || []).forEach((day) => {
        userMap.get(userId)!.assignments.push({
          projectId,
          projectName,
          projectColor,
          date: day.date,
          hours: day.hours,
        });
      });
    });

    return Array.from(userMap.values());
  } catch (error) {
    logger.error({ error }, 'Failed to fetch schedule data');
    return [];
  }
}

function getMockSchedule(daysToShow: number): ScheduleEntry[] {
  const startDate = startOfDay(new Date());
  const users = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Williams' },
  ];
  const projects = [
    { id: 'p1', name: 'Website Redesign', color: '#3b82f6' },
    { id: 'p2', name: 'Mobile App', color: '#10b981' },
    { id: 'p3', name: 'Brand Identity', color: '#f59e0b' },
  ];

  return users.map((user) => ({
    userId: user.id,
    userName: user.name,
    assignments: Array.from({ length: Math.floor(daysToShow / 2) }).map((_, i) => {
      const project = projects[Math.floor(Math.random() * projects.length)];
      return {
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
        date: format(addDays(startDate, i * 2), 'yyyy-MM-dd'),
        hours: 4 + Math.floor(Math.random() * 5),
      };
    }),
  }));
}
