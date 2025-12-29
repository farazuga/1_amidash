import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  differenceInDays,
  getDay,
  isWeekend,
} from 'date-fns';
import type { CalendarAssignmentResult, CalendarEvent, BookingStatus, AssignmentDay } from '@/types/calendar';
import { BOOKING_STATUS_ORDER } from './constants';

/**
 * Get all days to display in a month calendar view
 * Includes days from previous/next months to fill the grid
 */
export function getCalendarDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

/**
 * Get the date range for a month view
 */
export function getMonthViewRange(date: Date): { start: Date; end: Date } {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  return { start: calendarStart, end: calendarEnd };
}

/**
 * Navigate to next month
 */
export function getNextMonth(date: Date): Date {
  return addMonths(date, 1);
}

/**
 * Navigate to previous month
 */
export function getPreviousMonth(date: Date): Date {
  return subMonths(date, 1);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Check if a date is in the current month
 */
export function isCurrentMonth(date: Date, currentMonth: Date): boolean {
  return isSameMonth(date, currentMonth);
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date falls within a date range
 */
export function isDateInRange(date: Date, startDate: string | null, endDate: string | null): boolean {
  if (!startDate || !endDate) return false;

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  return isWithinInterval(date, { start, end });
}

/**
 * Check if a date is excluded from an assignment
 */
export function isDateExcluded(date: Date, excludedDates: string[]): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return excludedDates.includes(dateStr);
}

/**
 * Convert database assignment results to calendar events
 * @param assignments - Assignment data from database
 * @param excludedDatesMap - Map of assignment_id to excluded dates (legacy)
 * @param scheduledDaysMap - Map of assignment_id to scheduled work_dates (new model)
 */
export function convertToCalendarEvents(
  assignments: CalendarAssignmentResult[],
  excludedDatesMap: Map<string, string[]>,
  scheduledDaysMap?: Map<string, string[]>
): CalendarEvent[] {
  return assignments.map((assignment) => ({
    id: assignment.assignment_id,
    title: `${assignment.project_name} - ${assignment.user_name || 'Unknown'}`,
    start: parseISO(assignment.project_start_date),
    end: parseISO(assignment.project_end_date),
    projectId: assignment.project_id,
    projectName: assignment.project_name,
    userId: assignment.user_id,
    userName: assignment.user_name || 'Unknown',
    bookingStatus: assignment.booking_status,
    assignmentId: assignment.assignment_id,
    excludedDates: excludedDatesMap.get(assignment.assignment_id) || [],
    scheduledDays: scheduledDaysMap?.get(assignment.assignment_id) || [],
  }));
}

/**
 * Check if a date is in the scheduled days array
 */
export function isDateScheduled(date: Date, scheduledDays: string[]): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return scheduledDays.includes(dateStr);
}

/**
 * Get events for a specific day
 * Only shows events that have explicit scheduled days (from assignment_days table)
 */
export function getEventsForDay(
  date: Date,
  events: CalendarEvent[]
): CalendarEvent[] {
  return events.filter((event) => {
    // Only show events on days that are explicitly scheduled
    // If no days are scheduled, don't show the event on any day
    if (!event.scheduledDays || event.scheduledDays.length === 0) {
      return false;
    }
    return isDateScheduled(date, event.scheduledDays);
  });
}

/**
 * Sort events by booking status (confirmed first, then pending, then pencil)
 */
export function sortEventsByStatus(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const aIndex = BOOKING_STATUS_ORDER.indexOf(a.bookingStatus);
    const bIndex = BOOKING_STATUS_ORDER.indexOf(b.bookingStatus);
    return aIndex - bIndex;
  });
}

/**
 * Group events by user
 */
export function groupEventsByUser(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const existing = grouped.get(event.userId) || [];
    grouped.set(event.userId, [...existing, event]);
  });

  return grouped;
}

/**
 * Group events by project
 */
export function groupEventsByProject(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const existing = grouped.get(event.projectId) || [];
    grouped.set(event.projectId, [...existing, event]);
  });

  return grouped;
}

/**
 * Calculate project duration in days
 */
export function getProjectDuration(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
}

/**
 * Get date string in ISO format (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse ISO date string to Date
 */
export function fromISODateString(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Generate array of dates between start and end
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = eachDayOfInterval({ start, end });
  return days.map((d) => format(d, 'yyyy-MM-dd'));
}

/**
 * Check if two date ranges overlap
 */
export function doRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parseISO(start1);
  const e1 = parseISO(end1);
  const s2 = parseISO(start2);
  const e2 = parseISO(end2);

  return s1 <= e2 && s2 <= e1;
}

/**
 * Get human-readable date range string
 */
export function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return 'Dates not set';

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (isSameDay(start, end)) {
    return format(start, 'MMM d, yyyy');
  }

  if (isSameMonth(start, end)) {
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  }

  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Get user initials from name
 */
export function getUserInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Work weekdays only (Monday to Friday)
 */
export const WEEKDAYS_WORK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

/**
 * Get all weekdays (Mon-Fri) within a date range
 */
export function getWeekViewDays(startDate: string, endDate: string): Date[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = eachDayOfInterval({ start, end });

  // Filter to only weekdays (Mon-Fri)
  return days.filter((day) => !isWeekend(day));
}

/**
 * Get weeks in a date range for week view navigation
 */
export function getWeeksInRange(startDate: string, endDate: string): Date[][] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // Get start of each week in the range
  const weekStarts = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }); // Monday start

  return weekStarts.map((weekStart) => {
    const weekDays: Date[] = [];
    // Get Mon-Fri for each week
    for (let i = 0; i < 5; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      // Only include days within the project range
      if (day >= start && day <= end) {
        weekDays.push(day);
      }
    }
    return weekDays;
  }).filter(week => week.length > 0);
}

/**
 * Get the week number for a given date within a project range
 */
export function getWeekNumber(date: Date, projectStartDate: string): number {
  const start = parseISO(projectStartDate);
  const startOfProjectWeek = startOfWeek(start, { weekStartsOn: 1 });
  const startOfDateWeek = startOfWeek(date, { weekStartsOn: 1 });

  return Math.floor(differenceInDays(startOfDateWeek, startOfProjectWeek) / 7) + 1;
}

/**
 * Navigate to next week
 */
export function getNextWeek(date: Date): Date {
  return addWeeks(date, 1);
}

/**
 * Navigate to previous week
 */
export function getPreviousWeek(date: Date): Date {
  return subWeeks(date, 1);
}

/**
 * Check if a date is a weekday (Mon-Fri)
 */
export function isWeekday(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Format assignment dates for display
 * Returns a human-readable string like "Jan 15" or "Jan 15 - Jan 20 (5 days)"
 */
export function formatAssignmentDates(days?: AssignmentDay[]): string {
  if (!days?.length) return 'No dates scheduled';

  const sorted = [...days].sort((a, b) => a.work_date.localeCompare(b.work_date));

  if (days.length === 1) {
    return format(parseISO(sorted[0].work_date), 'MMM d');
  }

  return `${format(parseISO(sorted[0].work_date), 'MMM d')} - ${format(parseISO(sorted[sorted.length - 1].work_date), 'MMM d')} (${days.length} days)`;
}
