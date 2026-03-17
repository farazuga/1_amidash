/**
 * Mock factories for Microsoft Graph API / Outlook Calendar integration
 * Used in unit tests for calendar sync and Graph client utilities
 */

import { vi } from 'vitest';
import type {
  OutlookEvent,
  OutlookEventInput,
  SyncResult,
} from '@/lib/microsoft-graph/types';

// ============================================
// Mock access token
// ============================================

/**
 * Create a mock Microsoft Graph access token
 */
export function createMockAccessToken(): string {
  return 'mock-access-token-eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9';
}

// ============================================
// Mock Graph client
// ============================================

/**
 * Create a mock of all exported Graph client functions with realistic defaults.
 * Each function is a vi.fn() that can be overridden per test.
 */
export function createMockGraphClient() {
  return {
    createCalendarForUser: vi.fn().mockResolvedValue({
      id: 'mock-calendar-id-abc123',
      name: 'AmiDash',
    }),

    getCalendarForUser: vi.fn().mockResolvedValue({
      id: 'mock-calendar-id-abc123',
      name: 'AmiDash',
    }),

    createCalendarEvent: vi.fn().mockResolvedValue({
      id: 'mock-event-id-def456',
    }),

    updateCalendarEvent: vi.fn().mockResolvedValue({
      id: 'mock-event-id-def456',
    }),

    deleteCalendarEvent: vi.fn().mockResolvedValue(undefined),

    getCalendarEvents: vi.fn().mockResolvedValue([] as OutlookEvent[]),

    buildCalendarEvent: vi.fn().mockReturnValue({
      subject: 'Test Project',
      body: { contentType: 'text', content: 'Project: Test Project' },
      start: { dateTime: '2026-03-17T08:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-17T17:00:00', timeZone: 'UTC' },
      isAllDay: false,
      showAs: 'busy',
      categories: ['Green category'],
      sensitivity: 'normal',
    } satisfies OutlookEventInput),
  };
}

// ============================================
// Mock Outlook calendar event (read-only, from calendarView)
// ============================================

/**
 * Create a mock OutlookEvent as returned by getCalendarEvents
 */
export function createMockCalendarEvent(
  overrides: Partial<OutlookEvent> = {}
): OutlookEvent {
  return {
    id: 'mock-outlook-event-id-001',
    subject: 'Team Standup',
    start: { dateTime: '2026-03-17T09:00:00.0000000', timeZone: 'UTC' },
    end: { dateTime: '2026-03-17T09:30:00.0000000', timeZone: 'UTC' },
    isAllDay: false,
    showAs: 'busy',
    sensitivity: 'normal',
    isFromOutlook: true,
    ...overrides,
  };
}

// ============================================
// Mock synced_calendar_events DB row
// ============================================

/**
 * Create a mock row from the synced_calendar_events table
 */
export function createMockSyncedEvent(
  overrides: Partial<{
    id: string;
    assignment_id: string;
    user_id: string;
    work_date: string;
    external_event_id: string;
    last_synced_at: string;
    sync_error: string | null;
  }> = {}
) {
  return {
    id: 'mock-synced-event-id-001',
    assignment_id: 'mock-assignment-id-001',
    user_id: 'mock-user-id-001',
    work_date: '2026-03-17',
    external_event_id: 'mock-outlook-event-id-001',
    last_synced_at: '2026-03-17T12:00:00.000Z',
    sync_error: null,
    ...overrides,
  };
}

// ============================================
// Mock engineer_outlook_calendars DB row
// ============================================

/**
 * Create a mock row from the engineer_outlook_calendars table
 */
export function createMockOutlookCalendar(
  overrides: Partial<{
    id: string;
    user_id: string;
    outlook_calendar_id: string;
    outlook_email: string;
    created_at: string;
    updated_at: string;
  }> = {}
) {
  return {
    id: 'mock-cal-record-id-001',
    user_id: 'mock-user-id-001',
    outlook_calendar_id: 'mock-calendar-id-abc123',
    outlook_email: 'engineer@example.com',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-17T12:00:00.000Z',
    ...overrides,
  };
}

// ============================================
// Mock SyncResult
// ============================================

/**
 * Create a mock SyncResult as returned by sync operations
 */
export function createMockSyncResult(
  overrides: Partial<SyncResult> = {}
): SyncResult {
  return {
    success: true,
    eventId: 'mock-event-id-def456',
    ...overrides,
  };
}

// ============================================
// Mock auth module
// ============================================

/**
 * Create a mock of the auth module (getAppAccessToken, clearTokenCache)
 */
export function createMockAuth() {
  return {
    getAppAccessToken: vi.fn().mockResolvedValue(createMockAccessToken()),
    clearTokenCache: vi.fn(),
  };
}
