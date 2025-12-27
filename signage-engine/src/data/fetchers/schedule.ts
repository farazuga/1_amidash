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
  // Note: Schedule feature requires project_assignments table which doesn't exist yet
  // Using mock data until the table is created
  logger.debug('Using mock schedule data (project_assignments table not available)');
  return getMockSchedule(daysToShow);
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
