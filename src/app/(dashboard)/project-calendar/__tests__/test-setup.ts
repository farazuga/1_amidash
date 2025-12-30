/**
 * Test Setup for ProjectCalendarMonthView Component Tests
 *
 * This file provides:
 * - Test data factories for projects and assignments
 * - Mock configurations for external dependencies
 * - Fixture data for common test scenarios
 * - Utility functions for date manipulation in tests
 *
 * Following established patterns from:
 * - src/lib/calendar/__tests__/utils.test.ts
 * - src/app/(dashboard)/calendar/__tests__/actions.test.ts
 */

import { vi } from 'vitest';
import { format, addDays, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import type { BookingStatus } from '@/types/calendar';
import type { ProjectWithDetails } from '../use-projects-with-dates';

// ============================================
// Type Definitions
// ============================================

export interface TestProject {
  id: string;
  client_name: string;
  start_date: string;
  end_date: string;
  schedule_status: BookingStatus;
  assignments?: TestAssignment[];
}

export interface TestAssignment {
  id: string;
  user_id: string;
  user: {
    id: string;
    full_name: string;
  } | null;
}

// ============================================
// Date Utilities
// ============================================

/**
 * Convert a Date object to ISO date string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Create a date relative to a reference date
 */
export function dateOffset(referenceDate: Date, days: number): Date {
  return days >= 0 ? addDays(referenceDate, days) : subDays(referenceDate, Math.abs(days));
}

/**
 * Get the first Monday of a month
 */
export function getFirstMonday(month: Date): Date {
  const start = startOfMonth(month);
  const dayOfWeek = start.getDay();

  // If Sunday (0), add 1 day; if Monday (1), keep it; otherwise find next Monday
  if (dayOfWeek === 0) {
    return addDays(start, 1);
  } else if (dayOfWeek === 1) {
    return start;
  } else {
    return addDays(start, 8 - dayOfWeek);
  }
}

/**
 * Get a date range in ISO format
 */
export function createDateRange(startDate: Date, endDate: Date): { start: string; end: string } {
  return {
    start: toISODate(startDate),
    end: toISODate(endDate),
  };
}

/**
 * Check if a date is a weekday (Mon-Fri)
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Get only weekdays from a date range
 */
export function getWeekdaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = new Date(start);

  while (current <= end) {
    if (isWeekday(current)) {
      days.push(new Date(current));
    }
    current = addDays(current, 1);
  }

  return days;
}

// ============================================
// Test Data Factories
// ============================================

/**
 * Factory for creating test users/engineers
 */
export function createTestUser(options?: {
  id?: string;
  full_name?: string;
}): { id: string; full_name: string } {
  const id = options?.id || `user-${Math.random().toString(36).substr(2, 9)}`;
  const full_name = options?.full_name || `Test User ${id.slice(-4)}`;

  return { id, full_name };
}

/**
 * Factory for creating test project assignments
 */
export function createTestAssignment(options?: {
  id?: string;
  user_id?: string;
  user?: { id: string; full_name: string } | null;
}): TestAssignment {
  const id = options?.id || `assignment-${Math.random().toString(36).substr(2, 9)}`;
  const user_id = options?.user_id || `user-${Math.random().toString(36).substr(2, 9)}`;
  const user = options?.user !== undefined
    ? options.user
    : { id: user_id, full_name: `Engineer ${user_id.slice(-4)}` };

  return {
    id,
    user_id,
    user,
  };
}

/**
 * Factory for creating test projects
 */
export function createTestProject(options?: {
  id?: string;
  client_name?: string;
  start_date?: string;
  end_date?: string;
  schedule_status?: BookingStatus;
  assignments?: TestAssignment[];
}): ProjectWithDetails {
  const id = options?.id || `project-${Math.random().toString(36).substr(2, 9)}`;
  const client_name = options?.client_name || `Test Project ${id.slice(-4)}`;
  const start_date = options?.start_date || '2024-01-15';
  const end_date = options?.end_date || '2024-01-19';
  const schedule_status = options?.schedule_status || 'draft';
  const assignments = options?.assignments || [];

  return {
    id,
    client_name,
    start_date,
    end_date,
    schedule_status,
    assignments,
    // Required Project fields with defaults
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    description: null,
    po_number: null,
    contract_value: null,
    project_manager_id: null,
    billing_type: null,
    priority: 'medium',
  } as ProjectWithDetails;
}

/**
 * Factory for creating a project spanning multiple weeks
 */
export function createMultiWeekProject(options: {
  startWeek: number; // Week offset from current month
  duration: number; // Number of weeks
  currentMonth: Date;
  client_name?: string;
  schedule_status?: BookingStatus;
  assignments?: TestAssignment[];
}): ProjectWithDetails {
  const { startWeek, duration, currentMonth, client_name, schedule_status, assignments } = options;

  const firstMonday = getFirstMonday(currentMonth);
  const startDate = addDays(firstMonday, startWeek * 7);
  const endDate = addDays(startDate, (duration * 7) - 1);

  return createTestProject({
    client_name,
    start_date: toISODate(startDate),
    end_date: toISODate(endDate),
    schedule_status,
    assignments,
  });
}

/**
 * Factory for creating overlapping projects (for conflict testing)
 */
export function createOverlappingProjects(options: {
  startDate: Date;
  engineer: { id: string; full_name: string };
  currentMonth: Date;
}): [ProjectWithDetails, ProjectWithDetails] {
  const { startDate, engineer } = options;

  const assignment1 = createTestAssignment({
    user_id: engineer.id,
    user: engineer,
  });

  const assignment2 = createTestAssignment({
    user_id: engineer.id,
    user: engineer,
  });

  const project1 = createTestProject({
    client_name: 'Project A',
    start_date: toISODate(startDate),
    end_date: toISODate(addDays(startDate, 4)), // 1 week (Mon-Fri)
    schedule_status: 'confirmed',
    assignments: [assignment1],
  });

  const project2 = createTestProject({
    client_name: 'Project B',
    start_date: toISODate(addDays(startDate, 2)), // Overlaps by 3 days
    end_date: toISODate(addDays(startDate, 6)),
    schedule_status: 'tentative',
    assignments: [assignment2],
  });

  return [project1, project2];
}

// ============================================
// Test Fixtures
// ============================================

/**
 * Fixture: January 2024 month view
 * Monday, January 1 - Friday, February 2 (5 weeks)
 */
export const JANUARY_2024_FIXTURE = {
  currentMonth: new Date(2024, 0, 15), // January 15, 2024
  firstMonday: new Date(2024, 0, 1), // January 1, 2024 (Monday)
  lastFriday: new Date(2024, 1, 2), // February 2, 2024 (Friday) - to complete grid
  totalWeeks: 5,
  weekdaysCount: 25, // 5 weeks * 5 days
};

/**
 * Fixture: February 2024 month view (leap year)
 * Monday, January 29 - Friday, March 1 (5 weeks)
 */
export const FEBRUARY_2024_FIXTURE = {
  currentMonth: new Date(2024, 1, 15), // February 15, 2024
  firstMonday: new Date(2024, 0, 29), // January 29, 2024 (Monday)
  lastFriday: new Date(2024, 2, 1), // March 1, 2024 (Friday)
  totalWeeks: 5,
  weekdaysCount: 25,
};

/**
 * Fixture: Test engineers
 */
export const TEST_ENGINEERS = {
  alice: createTestUser({ id: 'user-alice', full_name: 'Alice Engineer' }),
  bob: createTestUser({ id: 'user-bob', full_name: 'Bob Developer' }),
  charlie: createTestUser({ id: 'user-charlie', full_name: 'Charlie Tech' }),
};

/**
 * Fixture: Empty month (no projects)
 */
export function createEmptyMonthFixture(currentMonth: Date) {
  return {
    currentMonth,
    projects: [],
  };
}

/**
 * Fixture: Month with single project
 */
export function createSingleProjectFixture(currentMonth: Date) {
  const firstMonday = getFirstMonday(currentMonth);
  const project = createTestProject({
    client_name: 'Acme Corp',
    start_date: toISODate(firstMonday),
    end_date: toISODate(addDays(firstMonday, 4)), // 1 week
    schedule_status: 'confirmed',
    assignments: [createTestAssignment({ user: TEST_ENGINEERS.alice })],
  });

  return {
    currentMonth,
    projects: [project],
  };
}

/**
 * Fixture: Month with multiple non-overlapping projects
 */
export function createMultipleProjectsFixture(currentMonth: Date) {
  const firstMonday = getFirstMonday(currentMonth);

  const projects = [
    createTestProject({
      client_name: 'Acme Corp',
      start_date: toISODate(firstMonday),
      end_date: toISODate(addDays(firstMonday, 4)),
      schedule_status: 'confirmed',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.alice })],
    }),
    createTestProject({
      client_name: 'Beta Inc',
      start_date: toISODate(addDays(firstMonday, 7)),
      end_date: toISODate(addDays(firstMonday, 11)),
      schedule_status: 'tentative',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.bob })],
    }),
    createTestProject({
      client_name: 'Gamma LLC',
      start_date: toISODate(addDays(firstMonday, 14)),
      end_date: toISODate(addDays(firstMonday, 18)),
      schedule_status: 'draft',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.charlie })],
    }),
  ];

  return {
    currentMonth,
    projects,
  };
}

/**
 * Fixture: Month with overlapping projects (conflict scenario)
 */
export function createConflictFixture(currentMonth: Date) {
  const firstMonday = getFirstMonday(currentMonth);
  const [project1, project2] = createOverlappingProjects({
    startDate: firstMonday,
    engineer: TEST_ENGINEERS.alice,
    currentMonth,
  });

  return {
    currentMonth,
    projects: [project1, project2],
    conflictingEngineer: TEST_ENGINEERS.alice,
  };
}

/**
 * Fixture: Month with project spanning multiple weeks
 */
export function createLongProjectFixture(currentMonth: Date) {
  const project = createMultiWeekProject({
    startWeek: 0,
    duration: 4, // 4 weeks
    currentMonth,
    client_name: 'Enterprise Project',
    schedule_status: 'confirmed',
    assignments: [
      createTestAssignment({ user: TEST_ENGINEERS.alice }),
      createTestAssignment({ user: TEST_ENGINEERS.bob }),
    ],
  });

  return {
    currentMonth,
    projects: [project],
  };
}

/**
 * Fixture: Month with projects in different statuses
 */
export function createMixedStatusFixture(currentMonth: Date) {
  const firstMonday = getFirstMonday(currentMonth);

  const projects = [
    createTestProject({
      client_name: 'Draft Project',
      start_date: toISODate(firstMonday),
      end_date: toISODate(addDays(firstMonday, 4)),
      schedule_status: 'draft',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.alice })],
    }),
    createTestProject({
      client_name: 'Tentative Project',
      start_date: toISODate(addDays(firstMonday, 7)),
      end_date: toISODate(addDays(firstMonday, 11)),
      schedule_status: 'tentative',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.bob })],
    }),
    createTestProject({
      client_name: 'Pending Project',
      start_date: toISODate(addDays(firstMonday, 14)),
      end_date: toISODate(addDays(firstMonday, 18)),
      schedule_status: 'pending_confirm',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.charlie })],
    }),
    createTestProject({
      client_name: 'Confirmed Project',
      start_date: toISODate(addDays(firstMonday, 21)),
      end_date: toISODate(addDays(firstMonday, 25)),
      schedule_status: 'confirmed',
      assignments: [createTestAssignment({ user: TEST_ENGINEERS.alice })],
    }),
  ];

  return {
    currentMonth,
    projects,
  };
}

// ============================================
// Mock Utilities
// ============================================

/**
 * Mock BOOKING_STATUS_CONFIG
 * Matches the structure from src/lib/calendar/constants.ts
 */
export const MOCK_BOOKING_STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    shortLabel: 'D',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    dotColor: 'bg-blue-500',
    description: 'PM planning - not visible to engineers',
    visibleToEngineers: false,
  },
  tentative: {
    label: 'Tentative',
    shortLabel: 'T',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300',
    dotColor: 'bg-amber-500',
    description: 'Planned but not yet sent to customer',
    visibleToEngineers: true,
  },
  pending_confirm: {
    label: 'Pending Confirmation',
    shortLabel: 'PC',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
    dotColor: 'bg-purple-500',
    description: 'Awaiting customer confirmation',
    visibleToEngineers: true,
  },
  confirmed: {
    label: 'Confirmed',
    shortLabel: 'C',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    dotColor: 'bg-green-500',
    description: 'Customer confirmed',
    visibleToEngineers: true,
  },
};

/**
 * Setup mocks for ProjectCalendarMonthView tests
 */
export function setupComponentMocks() {
  // Mock the constants module
  vi.mock('@/lib/calendar/constants', () => ({
    BOOKING_STATUS_CONFIG: MOCK_BOOKING_STATUS_CONFIG,
    BOOKING_STATUS_ORDER: ['confirmed', 'pending_confirm', 'tentative', 'draft'],
    BOOKING_STATUS_CYCLE: ['draft', 'tentative', 'confirmed'],
    DEFAULT_WORKING_HOURS: { start: '07:00', end: '16:00' },
    WEEKDAYS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    WEEKDAYS_FULL: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    MONTHS: ['January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'],
  }));

  // Note: Mock setup is provided as documentation
  // In actual test files (.test.tsx), you can use these mocks:

  /*
  vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: any) =>
      React.createElement('a', { href, ...props }, children),
  }));

  vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    TooltipContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
      asChild ? children : React.createElement('div', null, children),
  }));

  vi.mock('lucide-react', () => ({
    AlertTriangle: () =>
      React.createElement('span', { 'data-testid': 'alert-triangle-icon' }, '⚠️'),
  }));
  */

  // Mock cn utility
  vi.mock('@/lib/utils', () => ({
    cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  }));
}

/**
 * Reset all mocks between tests
 */
export function resetComponentMocks() {
  vi.clearAllMocks();
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that a project bar has correct positioning
 *
 * Usage in tests:
 * ```
 * import { expect } from 'vitest';
 * const bar = screen.getByText('Project').closest('a');
 * assertBarPosition(bar, expect, { left: '0%', width: '20%' });
 * ```
 */
export function assertBarPosition(
  bar: HTMLElement,
  expectFn: any, // Should be 'expect' from vitest
  expected: {
    left?: string;
    width?: string;
    top?: string;
  }
) {
  const style = bar.style;

  if (expected.left !== undefined) {
    expectFn(style.left).toMatch(new RegExp(expected.left));
  }
  if (expected.width !== undefined) {
    expectFn(style.width).toMatch(new RegExp(expected.width));
  }
  if (expected.top !== undefined) {
    expectFn(style.top).toMatch(new RegExp(expected.top));
  }
}

/**
 * Get project bar element by project name
 */
export function getProjectBar(container: HTMLElement, projectName: string): HTMLElement | null {
  return container.querySelector(`[href*="/projects/"] span:contains("${projectName}")`)?.closest('a') || null;
}

/**
 * Count visible project bars
 */
export function countProjectBars(container: HTMLElement): number {
  return container.querySelectorAll('[href*="/projects/"]').length;
}

/**
 * Check if conflict indicator is present
 */
export function hasConflictIndicator(projectBar: HTMLElement): boolean {
  return projectBar.querySelector('[data-testid="alert-triangle-icon"]') !== null;
}
