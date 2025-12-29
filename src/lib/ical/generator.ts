import ical, { ICalCalendar, ICalEventStatus } from 'ical-generator';
import { format, parseISO, eachDayOfInterval, parse } from 'date-fns';
import type { BookingStatus, AssignmentDay } from '@/types/calendar';

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  projectName: string;
  userName?: string;
  allDay?: boolean;
}

interface AssignmentDayData {
  id: string;
  assignment_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
}

interface GenerateCalendarOptions {
  name: string;
  description?: string;
  events: CalendarEvent[];
  timezone?: string;
}

// Map booking status to iCal status
function mapBookingStatusToICalStatus(status: BookingStatus): ICalEventStatus {
  switch (status) {
    case 'confirmed':
      return ICalEventStatus.CONFIRMED;
    case 'pending_confirm':
    case 'tentative':
    case 'draft':
      return ICalEventStatus.TENTATIVE;
    default:
      return ICalEventStatus.TENTATIVE;
  }
}

// Get status label for display
function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending_confirm':
      return 'Pending Confirm';
    case 'tentative':
      return 'Tentative';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

/**
 * Generate an iCal calendar from events
 */
export function generateCalendar(options: GenerateCalendarOptions): ICalCalendar {
  const calendar = ical({
    name: options.name,
    description: options.description,
    timezone: options.timezone || 'America/New_York',
    prodId: {
      company: 'Amitrace',
      product: 'Project Calendar',
    },
  });

  for (const event of options.events) {
    const statusLabel = getStatusLabel(event.status);

    calendar.createEvent({
      id: event.id,
      summary: `[${statusLabel}] ${event.summary}`,
      description: event.description,
      start: event.start,
      end: event.end,
      allDay: event.allDay ?? true,
      status: mapBookingStatusToICalStatus(event.status),
      categories: [
        { name: statusLabel },
        { name: event.projectName },
      ],
    });
  }

  return calendar;
}

/**
 * Build calendar events from project assignments data
 */
export function buildEventsFromAssignments(
  assignments: Array<{
    assignment_id: string;
    project_id: string;
    project_name: string;
    user_id: string;
    user_name: string | null;
    booking_status: BookingStatus;
    project_start_date: string;
    project_end_date: string;
  }>,
  excludedDatesMap: Map<string, string[]>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const assignment of assignments) {
    const excludedDates = new Set(excludedDatesMap.get(assignment.assignment_id) || []);
    const startDate = parseISO(assignment.project_start_date);
    const endDate = parseISO(assignment.project_end_date);

    // Generate individual day events (excluding excluded dates)
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    for (const day of allDays) {
      const dayStr = format(day, 'yyyy-MM-dd');

      // Skip excluded dates
      if (excludedDates.has(dayStr)) continue;

      // Create end date (next day for all-day events)
      const eventEnd = new Date(day);
      eventEnd.setDate(eventEnd.getDate() + 1);

      events.push({
        id: `${assignment.assignment_id}-${dayStr}`,
        summary: `${assignment.project_name} - ${assignment.user_name || 'Team Member'}`,
        description: buildEventDescription(assignment),
        start: day,
        end: eventEnd,
        status: assignment.booking_status,
        projectName: assignment.project_name,
        userName: assignment.user_name || undefined,
        allDay: true,
      });
    }
  }

  return events;
}

/**
 * Build a consolidated calendar with date ranges instead of individual days
 * More efficient for longer projects
 */
export function buildConsolidatedEvents(
  assignments: Array<{
    assignment_id: string;
    project_id: string;
    project_name: string;
    user_id: string;
    user_name: string | null;
    booking_status: BookingStatus;
    project_start_date: string;
    project_end_date: string;
  }>
): CalendarEvent[] {
  return assignments.map((assignment) => {
    const startDate = parseISO(assignment.project_start_date);
    // iCal all-day events: end date should be the day AFTER the last day
    const endDate = parseISO(assignment.project_end_date);
    endDate.setDate(endDate.getDate() + 1);

    return {
      id: assignment.assignment_id,
      summary: `${assignment.project_name} - ${assignment.user_name || 'Team Member'}`,
      description: buildEventDescription(assignment),
      start: startDate,
      end: endDate,
      status: assignment.booking_status,
      projectName: assignment.project_name,
      userName: assignment.user_name || undefined,
      allDay: true,
    };
  });
}

function buildEventDescription(assignment: {
  project_name: string;
  user_name: string | null;
  booking_status: BookingStatus;
  project_start_date: string;
  project_end_date: string;
}): string {
  const lines = [
    `Project: ${assignment.project_name}`,
    `Assigned To: ${assignment.user_name || 'Team Member'}`,
    `Status: ${getStatusLabel(assignment.booking_status)}`,
    `Dates: ${format(parseISO(assignment.project_start_date), 'MMM d, yyyy')} - ${format(parseISO(assignment.project_end_date), 'MMM d, yyyy')}`,
    '',
    'Generated by Amitrace Project Calendar',
  ];

  return lines.join('\n');
}

/**
 * Generate iCal string from calendar
 */
export function calendarToString(calendar: ICalCalendar): string {
  return calendar.toString();
}

/**
 * Build calendar events from assignment days with specific times
 * This creates timed events instead of all-day events
 */
export function buildEventsFromAssignmentDays(
  assignments: Array<{
    assignment_id: string;
    project_id: string;
    project_name: string;
    user_id: string;
    user_name: string | null;
    booking_status: BookingStatus;
  }>,
  assignmentDaysMap: Map<string, AssignmentDayData[]>
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const assignment of assignments) {
    const days = assignmentDaysMap.get(assignment.assignment_id) || [];

    for (const day of days) {
      // Parse the date and times
      const dateStr = day.work_date;
      const startTimeStr = day.start_time.slice(0, 5); // HH:MM
      const endTimeStr = day.end_time.slice(0, 5); // HH:MM

      // Create start datetime
      const startDate = parseISO(dateStr);
      const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
      startDate.setHours(startHours, startMinutes, 0, 0);

      // Create end datetime
      const endDate = parseISO(dateStr);
      const [endHours, endMinutes] = endTimeStr.split(':').map(Number);
      endDate.setHours(endHours, endMinutes, 0, 0);

      events.push({
        id: day.id,
        summary: `${assignment.project_name} - ${assignment.user_name || 'Team Member'}`,
        description: buildEventDescriptionWithTimes(assignment, day),
        start: startDate,
        end: endDate,
        status: assignment.booking_status,
        projectName: assignment.project_name,
        userName: assignment.user_name || undefined,
        allDay: false,
      });
    }
  }

  return events;
}

function buildEventDescriptionWithTimes(
  assignment: {
    project_name: string;
    user_name: string | null;
    booking_status: BookingStatus;
  },
  day: AssignmentDayData
): string {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const lines = [
    `Project: ${assignment.project_name}`,
    `Assigned To: ${assignment.user_name || 'Team Member'}`,
    `Status: ${getStatusLabel(assignment.booking_status)}`,
    `Date: ${format(parseISO(day.work_date), 'EEEE, MMM d, yyyy')}`,
    `Time: ${formatTime(day.start_time.slice(0, 5))} - ${formatTime(day.end_time.slice(0, 5))}`,
    '',
    'Generated by Amitrace Project Calendar',
  ];

  return lines.join('\n');
}
