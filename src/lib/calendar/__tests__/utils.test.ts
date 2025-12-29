import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCalendarDays,
  getMonthViewRange,
  getNextMonth,
  getPreviousMonth,
  formatDate,
  isCurrentMonth,
  isToday,
  isDateInRange,
  isDateExcluded,
  convertToCalendarEvents,
  getEventsForDay,
  sortEventsByStatus,
  groupEventsByUser,
  groupEventsByProject,
  getProjectDuration,
  toISODateString,
  fromISODateString,
  getDateRange,
  doRangesOverlap,
  formatDateRange,
  getUserInitials,
  formatAssignmentDates,
} from '../utils';
import type { CalendarAssignmentResult, CalendarEvent, AssignmentDay } from '@/types/calendar';

describe('Calendar Utils', () => {
  describe('getCalendarDays', () => {
    it('returns all days for a month calendar grid', () => {
      // January 2024 starts on Monday, ends on Wednesday
      const date = new Date(2024, 0, 15); // January 15, 2024
      const days = getCalendarDays(date);

      // Should return at least 28 days (for January) + days to fill grid
      expect(days.length).toBeGreaterThanOrEqual(28);
      // Grid should be complete weeks (divisible by 7)
      expect(days.length % 7).toBe(0);
    });

    it('includes days from previous month to fill the grid', () => {
      // February 2024 starts on Thursday
      const date = new Date(2024, 1, 15); // February 15, 2024
      const days = getCalendarDays(date);

      // First day should be a Sunday from January
      expect(days[0].getDay()).toBe(0); // Sunday
    });

    it('includes days from next month to fill the grid', () => {
      const date = new Date(2024, 0, 15);
      const days = getCalendarDays(date);

      // Last day should be a Saturday
      expect(days[days.length - 1].getDay()).toBe(6); // Saturday
    });
  });

  describe('getMonthViewRange', () => {
    it('returns start and end dates for calendar view', () => {
      const date = new Date(2024, 0, 15);
      const range = getMonthViewRange(date);

      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());
    });

    it('start is always a Sunday', () => {
      const date = new Date(2024, 1, 15);
      const range = getMonthViewRange(date);

      expect(range.start.getDay()).toBe(0);
    });

    it('end is always a Saturday', () => {
      const date = new Date(2024, 1, 15);
      const range = getMonthViewRange(date);

      expect(range.end.getDay()).toBe(6);
    });
  });

  describe('getNextMonth', () => {
    it('returns the next month', () => {
      const date = new Date(2024, 0, 15);
      const next = getNextMonth(date);

      expect(next.getMonth()).toBe(1); // February
      expect(next.getFullYear()).toBe(2024);
    });

    it('handles year boundary', () => {
      const date = new Date(2024, 11, 15); // December
      const next = getNextMonth(date);

      expect(next.getMonth()).toBe(0); // January
      expect(next.getFullYear()).toBe(2025);
    });
  });

  describe('getPreviousMonth', () => {
    it('returns the previous month', () => {
      const date = new Date(2024, 5, 15); // June
      const prev = getPreviousMonth(date);

      expect(prev.getMonth()).toBe(4); // May
      expect(prev.getFullYear()).toBe(2024);
    });

    it('handles year boundary', () => {
      const date = new Date(2024, 0, 15); // January
      const prev = getPreviousMonth(date);

      expect(prev.getMonth()).toBe(11); // December
      expect(prev.getFullYear()).toBe(2023);
    });
  });

  describe('formatDate', () => {
    it('formats date with default format', () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date);

      expect(result).toBe('Jan 15, 2024');
    });

    it('formats date with custom format', () => {
      const date = new Date(2024, 0, 15);
      const result = formatDate(date, 'yyyy-MM-dd');

      expect(result).toBe('2024-01-15');
    });

    it('handles ISO string input', () => {
      const result = formatDate('2024-01-15');

      expect(result).toBe('Jan 15, 2024');
    });
  });

  describe('isCurrentMonth', () => {
    it('returns true for date in current month', () => {
      const date = new Date(2024, 5, 10);
      const currentMonth = new Date(2024, 5, 15);

      expect(isCurrentMonth(date, currentMonth)).toBe(true);
    });

    it('returns false for date in different month', () => {
      const date = new Date(2024, 4, 10);
      const currentMonth = new Date(2024, 5, 15);

      expect(isCurrentMonth(date, currentMonth)).toBe(false);
    });
  });

  describe('isToday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for today', () => {
      const today = new Date(2024, 5, 15);
      expect(isToday(today)).toBe(true);
    });

    it('returns false for other days', () => {
      const yesterday = new Date(2024, 5, 14);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isDateInRange', () => {
    it('returns true for date within range', () => {
      const date = new Date(2024, 0, 15);
      const result = isDateInRange(date, '2024-01-10', '2024-01-20');

      expect(result).toBe(true);
    });

    it('returns true for date on range boundary', () => {
      const date = new Date(2024, 0, 10);
      const result = isDateInRange(date, '2024-01-10', '2024-01-20');

      expect(result).toBe(true);
    });

    it('returns false for date outside range', () => {
      const date = new Date(2024, 0, 5);
      const result = isDateInRange(date, '2024-01-10', '2024-01-20');

      expect(result).toBe(false);
    });

    it('returns false for null start date', () => {
      const date = new Date(2024, 0, 15);
      const result = isDateInRange(date, null, '2024-01-20');

      expect(result).toBe(false);
    });

    it('returns false for null end date', () => {
      const date = new Date(2024, 0, 15);
      const result = isDateInRange(date, '2024-01-10', null);

      expect(result).toBe(false);
    });
  });

  describe('isDateExcluded', () => {
    it('returns true for excluded date', () => {
      const date = new Date(2024, 0, 15);
      const excluded = ['2024-01-15', '2024-01-16'];

      expect(isDateExcluded(date, excluded)).toBe(true);
    });

    it('returns false for non-excluded date', () => {
      const date = new Date(2024, 0, 17);
      const excluded = ['2024-01-15', '2024-01-16'];

      expect(isDateExcluded(date, excluded)).toBe(false);
    });

    it('returns false for empty excluded list', () => {
      const date = new Date(2024, 0, 15);
      expect(isDateExcluded(date, [])).toBe(false);
    });
  });

  describe('convertToCalendarEvents', () => {
    it('converts assignment results to calendar events', () => {
      const assignments: CalendarAssignmentResult[] = [
        {
          assignment_id: 'a1',
          project_id: 'p1',
          project_name: 'Test Project',
          project_start_date: '2024-01-10',
          project_end_date: '2024-01-20',
          user_id: 'u1',
          user_name: 'John Doe',
          booking_status: 'confirmed',
        },
      ];
      const excludedDatesMap = new Map<string, string[]>();

      const events = convertToCalendarEvents(assignments, excludedDatesMap);

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('a1');
      expect(events[0].projectName).toBe('Test Project');
      expect(events[0].userName).toBe('John Doe');
      expect(events[0].bookingStatus).toBe('confirmed');
    });

    it('includes excluded dates from map', () => {
      const assignments: CalendarAssignmentResult[] = [
        {
          assignment_id: 'a1',
          project_id: 'p1',
          project_name: 'Test Project',
          project_start_date: '2024-01-10',
          project_end_date: '2024-01-20',
          user_id: 'u1',
          user_name: 'John Doe',
          booking_status: 'confirmed',
        },
      ];
      const excludedDatesMap = new Map([['a1', ['2024-01-15', '2024-01-16']]]);

      const events = convertToCalendarEvents(assignments, excludedDatesMap);

      expect(events[0].excludedDates).toEqual(['2024-01-15', '2024-01-16']);
    });

    it('handles null user name', () => {
      const assignments: CalendarAssignmentResult[] = [
        {
          assignment_id: 'a1',
          project_id: 'p1',
          project_name: 'Test Project',
          project_start_date: '2024-01-10',
          project_end_date: '2024-01-20',
          user_id: 'u1',
          user_name: null,
          booking_status: 'draft',
        },
      ];
      const excludedDatesMap = new Map<string, string[]>();

      const events = convertToCalendarEvents(assignments, excludedDatesMap);

      expect(events[0].userName).toBe('Unknown');
    });
  });

  describe('getEventsForDay', () => {
    const createEvent = (
      id: string,
      startDate: string,
      endDate: string,
      excludedDates: string[] = []
    ): CalendarEvent => ({
      id,
      title: 'Test',
      start: new Date(startDate),
      end: new Date(endDate),
      projectId: 'p1',
      projectName: 'Test',
      userId: 'u1',
      userName: 'User',
      bookingStatus: 'confirmed',
      assignmentId: id,
      excludedDates,
    });

    it('returns events that include the day', () => {
      const events = [
        createEvent('e1', '2024-01-10', '2024-01-20'),
        createEvent('e2', '2024-01-15', '2024-01-25'),
      ];
      const day = new Date(2024, 0, 15);

      const result = getEventsForDay(day, events);

      expect(result).toHaveLength(2);
    });

    it('excludes events not on the day', () => {
      const events = [
        createEvent('e1', '2024-01-10', '2024-01-14'),
        createEvent('e2', '2024-01-20', '2024-01-25'),
      ];
      const day = new Date(2024, 0, 15);

      const result = getEventsForDay(day, events);

      expect(result).toHaveLength(0);
    });

    it('excludes events with excluded dates', () => {
      const events = [
        createEvent('e1', '2024-01-10', '2024-01-20', ['2024-01-15']),
      ];
      const day = new Date(2024, 0, 15);

      const result = getEventsForDay(day, events);

      expect(result).toHaveLength(0);
    });
  });

  describe('sortEventsByStatus', () => {
    it('sorts confirmed first, then pending, then tentative, then draft', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Test',
          userId: 'u1',
          userName: 'User',
          bookingStatus: 'draft',
          assignmentId: '1',
          excludedDates: [],
          scheduledDays: [],
        },
        {
          id: '2',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Test',
          userId: 'u1',
          userName: 'User',
          bookingStatus: 'confirmed',
          assignmentId: '2',
          excludedDates: [],
          scheduledDays: [],
        },
        {
          id: '3',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Test',
          userId: 'u1',
          userName: 'User',
          bookingStatus: 'pending_confirm',
          assignmentId: '3',
          excludedDates: [],
          scheduledDays: [],
        },
        {
          id: '4',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Test',
          userId: 'u1',
          userName: 'User',
          bookingStatus: 'tentative',
          assignmentId: '4',
          excludedDates: [],
          scheduledDays: [],
        },
      ];

      const sorted = sortEventsByStatus(events);

      expect(sorted[0].bookingStatus).toBe('confirmed');
      expect(sorted[1].bookingStatus).toBe('pending_confirm');
      expect(sorted[2].bookingStatus).toBe('tentative');
      expect(sorted[3].bookingStatus).toBe('draft');
    });

    it('does not mutate original array', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Test',
          userId: 'u1',
          userName: 'User',
          bookingStatus: 'draft',
          assignmentId: '1',
          excludedDates: [],
          scheduledDays: [],
        },
      ];

      const sorted = sortEventsByStatus(events);

      expect(sorted).not.toBe(events);
    });
  });

  describe('groupEventsByUser', () => {
    it('groups events by user ID', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Test',
          userId: 'u1',
          userName: 'User 1',
          bookingStatus: 'confirmed',
          assignmentId: '1',
          excludedDates: [],
        },
        {
          id: '2',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p2',
          projectName: 'Test 2',
          userId: 'u1',
          userName: 'User 1',
          bookingStatus: 'confirmed',
          assignmentId: '2',
          excludedDates: [],
        },
        {
          id: '3',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p3',
          projectName: 'Test 3',
          userId: 'u2',
          userName: 'User 2',
          bookingStatus: 'confirmed',
          assignmentId: '3',
          excludedDates: [],
        },
      ];

      const grouped = groupEventsByUser(events);

      expect(grouped.size).toBe(2);
      expect(grouped.get('u1')).toHaveLength(2);
      expect(grouped.get('u2')).toHaveLength(1);
    });
  });

  describe('groupEventsByProject', () => {
    it('groups events by project ID', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Project 1',
          userId: 'u1',
          userName: 'User',
          bookingStatus: 'confirmed',
          assignmentId: '1',
          excludedDates: [],
        },
        {
          id: '2',
          title: 'Test',
          start: new Date(),
          end: new Date(),
          projectId: 'p1',
          projectName: 'Project 1',
          userId: 'u2',
          userName: 'User 2',
          bookingStatus: 'confirmed',
          assignmentId: '2',
          excludedDates: [],
        },
      ];

      const grouped = groupEventsByProject(events);

      expect(grouped.size).toBe(1);
      expect(grouped.get('p1')).toHaveLength(2);
    });
  });

  describe('getProjectDuration', () => {
    it('returns correct duration in days', () => {
      const duration = getProjectDuration('2024-01-10', '2024-01-15');

      expect(duration).toBe(6); // Inclusive of both start and end
    });

    it('returns 1 for same day', () => {
      const duration = getProjectDuration('2024-01-10', '2024-01-10');

      expect(duration).toBe(1);
    });

    it('returns 0 for null start date', () => {
      const duration = getProjectDuration(null, '2024-01-15');

      expect(duration).toBe(0);
    });

    it('returns 0 for null end date', () => {
      const duration = getProjectDuration('2024-01-10', null);

      expect(duration).toBe(0);
    });
  });

  describe('toISODateString', () => {
    it('converts date to ISO format', () => {
      const date = new Date(2024, 0, 15);
      const result = toISODateString(date);

      expect(result).toBe('2024-01-15');
    });
  });

  describe('fromISODateString', () => {
    it('parses ISO string to date', () => {
      const result = fromISODateString('2024-01-15');

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('getDateRange', () => {
    it('returns array of date strings', () => {
      const result = getDateRange('2024-01-10', '2024-01-13');

      expect(result).toEqual([
        '2024-01-10',
        '2024-01-11',
        '2024-01-12',
        '2024-01-13',
      ]);
    });

    it('returns single date for same start and end', () => {
      const result = getDateRange('2024-01-10', '2024-01-10');

      expect(result).toEqual(['2024-01-10']);
    });
  });

  describe('doRangesOverlap', () => {
    it('returns true for overlapping ranges', () => {
      const result = doRangesOverlap(
        '2024-01-10',
        '2024-01-20',
        '2024-01-15',
        '2024-01-25'
      );

      expect(result).toBe(true);
    });

    it('returns true for adjacent ranges (touching)', () => {
      const result = doRangesOverlap(
        '2024-01-10',
        '2024-01-15',
        '2024-01-15',
        '2024-01-20'
      );

      expect(result).toBe(true);
    });

    it('returns true for contained range', () => {
      const result = doRangesOverlap(
        '2024-01-10',
        '2024-01-30',
        '2024-01-15',
        '2024-01-20'
      );

      expect(result).toBe(true);
    });

    it('returns false for non-overlapping ranges', () => {
      const result = doRangesOverlap(
        '2024-01-10',
        '2024-01-14',
        '2024-01-16',
        '2024-01-20'
      );

      expect(result).toBe(false);
    });
  });

  describe('formatDateRange', () => {
    it('formats single day range', () => {
      const result = formatDateRange('2024-01-15', '2024-01-15');

      expect(result).toBe('Jan 15, 2024');
    });

    it('formats same month range', () => {
      const result = formatDateRange('2024-01-10', '2024-01-20');

      expect(result).toBe('Jan 10 - 20, 2024');
    });

    it('formats different month range', () => {
      const result = formatDateRange('2024-01-10', '2024-02-15');

      expect(result).toBe('Jan 10, 2024 - Feb 15, 2024');
    });

    it('returns placeholder for null dates', () => {
      expect(formatDateRange(null, null)).toBe('Dates not set');
      expect(formatDateRange('2024-01-10', null)).toBe('Dates not set');
      expect(formatDateRange(null, '2024-01-20')).toBe('Dates not set');
    });
  });

  describe('getUserInitials', () => {
    it('returns initials for full name', () => {
      expect(getUserInitials('John Doe')).toBe('JD');
    });

    it('returns single initial for single name', () => {
      expect(getUserInitials('John')).toBe('J');
    });

    it('returns max 2 initials for long names', () => {
      expect(getUserInitials('John Michael Doe')).toBe('JM');
    });

    it('returns ? for null name', () => {
      expect(getUserInitials(null)).toBe('?');
    });

    it('handles empty string', () => {
      expect(getUserInitials('')).toBe('?');
    });
  });

  describe('formatAssignmentDates', () => {
    const createDay = (date: string): AssignmentDay => ({
      id: `day-${date}`,
      assignment_id: 'assignment-1',
      work_date: date,
      start_time: '07:00:00',
      end_time: '16:00:00',
      created_by: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });

    it('returns "No dates scheduled" for undefined', () => {
      expect(formatAssignmentDates(undefined)).toBe('No dates scheduled');
    });

    it('returns "No dates scheduled" for empty array', () => {
      expect(formatAssignmentDates([])).toBe('No dates scheduled');
    });

    it('formats single day correctly', () => {
      const days = [createDay('2024-01-15')];
      expect(formatAssignmentDates(days)).toBe('Jan 15');
    });

    it('formats two days with range', () => {
      const days = [createDay('2024-01-15'), createDay('2024-01-16')];
      expect(formatAssignmentDates(days)).toBe('Jan 15 - Jan 16 (2 days)');
    });

    it('formats multiple days with count', () => {
      const days = [
        createDay('2024-01-15'),
        createDay('2024-01-16'),
        createDay('2024-01-17'),
        createDay('2024-01-18'),
        createDay('2024-01-19'),
      ];
      expect(formatAssignmentDates(days)).toBe('Jan 15 - Jan 19 (5 days)');
    });

    it('sorts days chronologically', () => {
      // Days passed in wrong order
      const days = [
        createDay('2024-01-20'),
        createDay('2024-01-15'),
        createDay('2024-01-18'),
      ];
      expect(formatAssignmentDates(days)).toBe('Jan 15 - Jan 20 (3 days)');
    });

    it('handles non-consecutive days', () => {
      // Days with gaps - still shows first to last
      const days = [
        createDay('2024-01-15'),
        createDay('2024-01-18'),
        createDay('2024-01-22'),
      ];
      expect(formatAssignmentDates(days)).toBe('Jan 15 - Jan 22 (3 days)');
    });

    it('handles days across months', () => {
      const days = [
        createDay('2024-01-30'),
        createDay('2024-01-31'),
        createDay('2024-02-01'),
        createDay('2024-02-02'),
      ];
      expect(formatAssignmentDates(days)).toBe('Jan 30 - Feb 2 (4 days)');
    });
  });
});
