import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockGraphClient,
  createMockSyncedEvent,
  createMockOutlookCalendar,
} from '@/test/mocks/microsoft-graph';

// ============================================
// Mocks
// ============================================

const mockGraphClient = createMockGraphClient();

vi.mock('../client', () => ({
  createCalendarForUser: (...args: unknown[]) => mockGraphClient.createCalendarForUser(...args),
  getCalendarForUser: (...args: unknown[]) => mockGraphClient.getCalendarForUser(...args),
  createCalendarEvent: (...args: unknown[]) => mockGraphClient.createCalendarEvent(...args),
  updateCalendarEvent: (...args: unknown[]) => mockGraphClient.updateCalendarEvent(...args),
  deleteCalendarEvent: (...args: unknown[]) => mockGraphClient.deleteCalendarEvent(...args),
  buildCalendarEvent: (...args: unknown[]) => mockGraphClient.buildCalendarEvent(...args),
}));

vi.mock('../auth', () => ({
  getAppAccessToken: vi.fn().mockResolvedValue('mock-token'),
  clearTokenCache: vi.fn(),
}));

// Chainable Supabase mock
type ChainableQuery = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function createChainableQuery(resolvedValue: { data: unknown; error: unknown } | null = null): ChainableQuery {
  const defaultResult = resolvedValue || { data: null, error: null };
  const chain: ChainableQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(defaultResult),
  };

  // Make chain methods return the chain (except single which resolves)
  for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'in', 'not', 'order', 'limit'] as const) {
    chain[method].mockReturnValue(chain);
  }

  // Also make the chain itself thenable so it resolves for non-single queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (chain as any).then = (resolve: (val: unknown) => void, reject?: (err: unknown) => void) => {
    return Promise.resolve(defaultResult).then(resolve, reject);
  };

  return chain;
}

// Table-specific query builders
const tableQueries: Record<string, ChainableQuery> = {};

function getOrCreateTableQuery(table: string): ChainableQuery {
  if (!tableQueries[table]) {
    tableQueries[table] = createChainableQuery();
  }
  return tableQueries[table];
}

const mockSupabaseFrom = vi.fn((table: string) => getOrCreateTableQuery(table));

const mockSupabase = {
  from: mockSupabaseFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockSupabaseFrom(...(args as [string])),
  }),
}));

// ============================================
// Helpers
// ============================================

const TEST_USER_ID = 'test-user-id-001';
const TEST_EMAIL = 'engineer@example.com';
const TEST_CALENDAR_ID = 'mock-calendar-id-abc123';
const TEST_ASSIGNMENT_ID = 'test-assignment-id-001';
const TEST_PROJECT_ID = 'test-project-id-001';

function setupTableQuery(table: string, result: { data: unknown; error: unknown }): ChainableQuery {
  const query = createChainableQuery(result);
  tableQueries[table] = query;
  return query;
}

/**
 * Sets up the standard table mocks needed for triggerAssignmentSync flows.
 * Each call overrides previous mocks for the same table, so order matters
 * when a table is queried multiple times (we handle that with call-specific returns).
 */
function setupTriggerSyncMocks(opts: {
  email?: string | null;
  calendarRecord?: ReturnType<typeof createMockOutlookCalendar> | null;
  calendarExistsInOutlook?: boolean;
  days?: Array<{ work_date: string; start_time: string; end_time: string }>;
  teamData?: Array<{ user_id: string; profile: { full_name: string } }>;
  existingSynced?: Array<{ work_date: string; external_event_id: string }>;
}) {
  // profiles table — getEngineerEmail
  const profilesQuery = createChainableQuery({
    data: opts.email !== undefined ? (opts.email ? { email: opts.email } : null) : { email: TEST_EMAIL },
    error: opts.email === null ? { message: 'not found' } : null,
  });
  tableQueries['profiles'] = profilesQuery;

  // engineer_outlook_calendars — ensureAmiDashCalendar checks DB
  const calQuery = createChainableQuery({
    data: opts.calendarRecord ?? createMockOutlookCalendar(),
    error: opts.calendarRecord === null ? { code: 'PGRST116' } : null,
  });
  tableQueries['engineer_outlook_calendars'] = calQuery;

  // assignment_days
  const daysQuery = createChainableQuery({
    data: opts.days ?? [
      { work_date: '2026-03-17', start_time: '08:00:00', end_time: '17:00:00' },
    ],
    error: null,
  });
  tableQueries['assignment_days'] = daysQuery;

  // project_assignments (team members query via neq)
  const teamQuery = createChainableQuery({
    data: opts.teamData ?? [],
    error: null,
  });
  tableQueries['project_assignments'] = teamQuery;

  // synced_calendar_events — existing synced events
  const syncedQuery = createChainableQuery({
    data: opts.existingSynced ?? [],
    error: null,
  });
  tableQueries['synced_calendar_events'] = syncedQuery;

  // Graph client defaults
  if (opts.calendarExistsInOutlook !== false) {
    mockGraphClient.getCalendarForUser.mockResolvedValue({
      id: TEST_CALENDAR_ID,
      name: 'AmiDash',
    });
  } else {
    mockGraphClient.getCalendarForUser.mockResolvedValue(null);
  }
}

// ============================================
// Import module under test (after mocks)
// ============================================

import {
  ensureAmiDashCalendar,
  triggerAssignmentSync,
  deleteAssignmentFromOutlook,
  fullSyncForUser,
} from '../sync';

// ============================================
// Tests
// ============================================

describe('Microsoft Graph Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear table queries
    for (const key of Object.keys(tableQueries)) {
      delete tableQueries[key];
    }
  });

  // ------------------------------------------
  // ensureAmiDashCalendar
  // ------------------------------------------
  describe('ensureAmiDashCalendar', () => {
    it('returns existing calendar ID when it exists in DB and Outlook', async () => {
      const mockCal = createMockOutlookCalendar();
      setupTableQuery('engineer_outlook_calendars', {
        data: mockCal,
        error: null,
      });

      mockGraphClient.getCalendarForUser.mockResolvedValue({
        id: mockCal.outlook_calendar_id,
        name: 'AmiDash',
      });

      const result = await ensureAmiDashCalendar(TEST_USER_ID, TEST_EMAIL);

      expect(result).toBe(mockCal.outlook_calendar_id);
      expect(mockGraphClient.getCalendarForUser).toHaveBeenCalledWith(
        TEST_EMAIL,
        mockCal.outlook_calendar_id
      );
      expect(mockGraphClient.createCalendarForUser).not.toHaveBeenCalled();
    });

    it('creates new calendar when DB record exists but calendar deleted from Outlook', async () => {
      const mockCal = createMockOutlookCalendar();
      const calQuery = createChainableQuery({
        data: mockCal,
        error: null,
      });
      tableQueries['engineer_outlook_calendars'] = calQuery;

      // Calendar deleted from Outlook
      mockGraphClient.getCalendarForUser.mockResolvedValue(null);
      mockGraphClient.createCalendarForUser.mockResolvedValue({
        id: 'new-calendar-id-xyz',
        name: 'AmiDash',
      });

      const result = await ensureAmiDashCalendar(TEST_USER_ID, TEST_EMAIL);

      expect(result).toBe('new-calendar-id-xyz');
      expect(mockGraphClient.createCalendarForUser).toHaveBeenCalledWith(TEST_EMAIL);
    });

    it('creates new calendar when no DB record exists', async () => {
      setupTableQuery('engineer_outlook_calendars', {
        data: null,
        error: { code: 'PGRST116' },
      });

      mockGraphClient.createCalendarForUser.mockResolvedValue({
        id: 'brand-new-calendar-id',
        name: 'AmiDash',
      });

      const result = await ensureAmiDashCalendar(TEST_USER_ID, TEST_EMAIL);

      expect(result).toBe('brand-new-calendar-id');
      expect(mockGraphClient.createCalendarForUser).toHaveBeenCalledWith(TEST_EMAIL);
    });

    it('throws when Outlook API fails to create calendar', async () => {
      setupTableQuery('engineer_outlook_calendars', {
        data: null,
        error: { code: 'PGRST116' },
      });

      mockGraphClient.createCalendarForUser.mockRejectedValue(
        new Error('Graph API error: 403 Forbidden')
      );

      await expect(
        ensureAmiDashCalendar(TEST_USER_ID, TEST_EMAIL)
      ).rejects.toThrow('Graph API error: 403 Forbidden');
    });
  });

  // ------------------------------------------
  // triggerAssignmentSync
  // ------------------------------------------
  describe('triggerAssignmentSync', () => {
    it('syncs days for a confirmed assignment', async () => {
      setupTriggerSyncMocks({
        days: [
          { work_date: '2026-03-17', start_time: '08:00:00', end_time: '17:00:00' },
          { work_date: '2026-03-18', start_time: '08:00:00', end_time: '17:00:00' },
        ],
      });

      // synced_calendar_events: no existing events (getSyncedEvent returns null for slot reservation)
      // The sync module calls getSyncedEvent per day via reserveSyncSlot -> getSyncedEvent
      // and then inserts a pending slot. We need the single() calls to return null for slot reservation.
      const syncedQuery = tableQueries['synced_calendar_events'];
      syncedQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      mockGraphClient.createCalendarEvent.mockResolvedValue({ id: 'new-event-001' });

      await triggerAssignmentSync({
        id: TEST_ASSIGNMENT_ID,
        user_id: TEST_USER_ID,
        booking_status: 'confirmed',
        project_id: TEST_PROJECT_ID,
        project_name: 'Test Project',
      });

      // Should have called createCalendarEvent for each day
      expect(mockGraphClient.createCalendarEvent).toHaveBeenCalled();
      expect(mockGraphClient.buildCalendarEvent).toHaveBeenCalled();
    });

    it('deletes existing events for non-syncable status (draft)', async () => {
      // For deleteAssignmentFromOutlook: synced_calendar_events returns events
      const syncedEvents = [
        createMockSyncedEvent({ external_event_id: 'event-to-delete-1', work_date: '2026-03-17' }),
        createMockSyncedEvent({ external_event_id: 'event-to-delete-2', work_date: '2026-03-18' }),
      ];

      const syncedQuery = createChainableQuery({ data: syncedEvents, error: null });
      tableQueries['synced_calendar_events'] = syncedQuery;

      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      const calQuery = createChainableQuery({
        data: createMockOutlookCalendar(),
        error: null,
      });
      tableQueries['engineer_outlook_calendars'] = calQuery;

      await triggerAssignmentSync({
        id: TEST_ASSIGNMENT_ID,
        user_id: TEST_USER_ID,
        booking_status: 'draft',
        project_id: TEST_PROJECT_ID,
        project_name: 'Test Project',
      });

      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledTimes(2);
      expect(mockGraphClient.createCalendarEvent).not.toHaveBeenCalled();
    });

    it('returns early (no-op) when assignment has no days', async () => {
      setupTriggerSyncMocks({
        days: [],
      });

      await triggerAssignmentSync({
        id: TEST_ASSIGNMENT_ID,
        user_id: TEST_USER_ID,
        booking_status: 'confirmed',
        project_id: TEST_PROJECT_ID,
        project_name: 'Test Project',
      });

      expect(mockGraphClient.createCalendarEvent).not.toHaveBeenCalled();
      expect(mockGraphClient.updateCalendarEvent).not.toHaveBeenCalled();
    });

    it('returns early when engineer email not found', async () => {
      setupTriggerSyncMocks({ email: null });

      await triggerAssignmentSync({
        id: TEST_ASSIGNMENT_ID,
        user_id: TEST_USER_ID,
        booking_status: 'confirmed',
        project_id: TEST_PROJECT_ID,
      });

      expect(mockGraphClient.createCalendarEvent).not.toHaveBeenCalled();
    });

    it('updates existing event when slot has existing event ID', async () => {
      setupTriggerSyncMocks({
        days: [{ work_date: '2026-03-17', start_time: '08:00:00', end_time: '17:00:00' }],
      });

      // getSyncedEvent returns an existing event (slot reservation returns existingEventId)
      const syncedQuery = tableQueries['synced_calendar_events'];
      syncedQuery.single.mockResolvedValue({
        data: {
          id: 'synced-row-1',
          external_event_id: 'existing-outlook-event-id',
          last_synced_at: new Date().toISOString(),
        },
        error: null,
      });

      mockGraphClient.updateCalendarEvent.mockResolvedValue({ id: 'existing-outlook-event-id' });

      await triggerAssignmentSync({
        id: TEST_ASSIGNMENT_ID,
        user_id: TEST_USER_ID,
        booking_status: 'confirmed',
        project_id: TEST_PROJECT_ID,
        project_name: 'Test Project',
      });

      expect(mockGraphClient.updateCalendarEvent).toHaveBeenCalledWith(
        TEST_EMAIL,
        TEST_CALENDAR_ID,
        'existing-outlook-event-id',
        expect.any(Object)
      );
      expect(mockGraphClient.createCalendarEvent).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // deleteAssignmentFromOutlook
  // ------------------------------------------
  describe('deleteAssignmentFromOutlook', () => {
    it('deletes all synced events for an assignment', async () => {
      const syncedEvents = [
        createMockSyncedEvent({
          external_event_id: 'outlook-event-1',
          work_date: '2026-03-17',
        }),
        createMockSyncedEvent({
          external_event_id: 'outlook-event-2',
          work_date: '2026-03-18',
        }),
      ];

      const syncedQuery = createChainableQuery({ data: syncedEvents, error: null });
      tableQueries['synced_calendar_events'] = syncedQuery;

      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      const calQuery = createChainableQuery({
        data: createMockOutlookCalendar(),
        error: null,
      });
      tableQueries['engineer_outlook_calendars'] = calQuery;

      await deleteAssignmentFromOutlook(TEST_ASSIGNMENT_ID, TEST_USER_ID);

      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledTimes(2);
      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledWith(
        TEST_EMAIL,
        TEST_CALENDAR_ID,
        'outlook-event-1'
      );
      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledWith(
        TEST_EMAIL,
        TEST_CALENDAR_ID,
        'outlook-event-2'
      );
    });

    it('handles empty events list gracefully', async () => {
      const syncedQuery = createChainableQuery({ data: [], error: null });
      tableQueries['synced_calendar_events'] = syncedQuery;

      await deleteAssignmentFromOutlook(TEST_ASSIGNMENT_ID, TEST_USER_ID);

      expect(mockGraphClient.deleteCalendarEvent).not.toHaveBeenCalled();
    });

    it('handles null synced events (error case)', async () => {
      const syncedQuery = createChainableQuery({ data: null, error: { message: 'db error' } });
      tableQueries['synced_calendar_events'] = syncedQuery;

      await deleteAssignmentFromOutlook(TEST_ASSIGNMENT_ID, TEST_USER_ID);

      expect(mockGraphClient.deleteCalendarEvent).not.toHaveBeenCalled();
    });

    it('skips pending slot markers when deleting', async () => {
      const syncedEvents = [
        createMockSyncedEvent({
          external_event_id: '__pending__',
          work_date: '2026-03-17',
        }),
        createMockSyncedEvent({
          external_event_id: 'real-event-id',
          work_date: '2026-03-18',
        }),
      ];

      const syncedQuery = createChainableQuery({ data: syncedEvents, error: null });
      tableQueries['synced_calendar_events'] = syncedQuery;

      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      const calQuery = createChainableQuery({
        data: createMockOutlookCalendar(),
        error: null,
      });
      tableQueries['engineer_outlook_calendars'] = calQuery;

      await deleteAssignmentFromOutlook(TEST_ASSIGNMENT_ID, TEST_USER_ID);

      // Only deletes the real event, not the pending marker
      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledTimes(1);
      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledWith(
        TEST_EMAIL,
        TEST_CALENDAR_ID,
        'real-event-id'
      );
    });

    it('continues deleting other events when one deletion fails', async () => {
      const syncedEvents = [
        createMockSyncedEvent({
          external_event_id: 'event-fail',
          work_date: '2026-03-17',
        }),
        createMockSyncedEvent({
          external_event_id: 'event-success',
          work_date: '2026-03-18',
        }),
      ];

      const syncedQuery = createChainableQuery({ data: syncedEvents, error: null });
      tableQueries['synced_calendar_events'] = syncedQuery;

      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      const calQuery = createChainableQuery({
        data: createMockOutlookCalendar(),
        error: null,
      });
      tableQueries['engineer_outlook_calendars'] = calQuery;

      mockGraphClient.deleteCalendarEvent
        .mockRejectedValueOnce(new Error('404 Not Found'))
        .mockResolvedValueOnce(undefined);

      // Should not throw — continues processing
      await deleteAssignmentFromOutlook(TEST_ASSIGNMENT_ID, TEST_USER_ID);

      expect(mockGraphClient.deleteCalendarEvent).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------
  // fullSyncForUser
  // ------------------------------------------
  describe('fullSyncForUser', () => {
    it('returns no-email error when user has no email', async () => {
      const profilesQuery = createChainableQuery({
        data: null,
        error: { message: 'not found' },
      });
      tableQueries['profiles'] = profilesQuery;

      const result = await fullSyncForUser(TEST_USER_ID);

      expect(result).toEqual({
        synced: 0,
        failed: 0,
        errors: ['No email found for user'],
      });
    });

    it('returns calendar error when ensureAmiDashCalendar fails', async () => {
      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      // ensureAmiDashCalendar will query engineer_outlook_calendars
      setupTableQuery('engineer_outlook_calendars', {
        data: null,
        error: { code: 'PGRST116' },
      });

      mockGraphClient.createCalendarForUser.mockRejectedValue(
        new Error('Calendar creation failed')
      );

      const result = await fullSyncForUser(TEST_USER_ID);

      expect(result).toEqual({
        synced: 0,
        failed: 0,
        errors: ['Failed to ensure calendar: Calendar creation failed'],
      });
    });

    it('returns empty results when no confirmed assignments exist', async () => {
      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      setupTableQuery('engineer_outlook_calendars', {
        data: createMockOutlookCalendar(),
        error: null,
      });

      mockGraphClient.getCalendarForUser.mockResolvedValue({
        id: TEST_CALENDAR_ID,
        name: 'AmiDash',
      });

      // project_assignments returns empty (no confirmed assignments)
      const assignmentsQuery = createChainableQuery({
        data: [],
        error: null,
      });
      tableQueries['project_assignments'] = assignmentsQuery;

      const result = await fullSyncForUser(TEST_USER_ID);

      expect(result).toEqual({ synced: 0, failed: 0, errors: [] });
    });

    it('returns synced/failed counts for mixed results', async () => {
      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      setupTableQuery('engineer_outlook_calendars', {
        data: createMockOutlookCalendar(),
        error: null,
      });

      mockGraphClient.getCalendarForUser.mockResolvedValue({
        id: TEST_CALENDAR_ID,
        name: 'AmiDash',
      });

      // project_assignments returns one confirmed assignment
      const assignmentsQuery = createChainableQuery({
        data: [
          {
            id: 'assign-1',
            user_id: TEST_USER_ID,
            project_id: 'proj-1',
            booking_status: 'confirmed',
            project: { id: 'proj-1', client_name: 'Acme Corp' },
          },
        ],
        error: null,
      });
      tableQueries['project_assignments'] = assignmentsQuery;

      // assignment_days returns two days
      const daysQuery = createChainableQuery({
        data: [
          { assignment_id: 'assign-1', work_date: '2026-03-17', start_time: '08:00:00', end_time: '17:00:00' },
          { assignment_id: 'assign-1', work_date: '2026-03-18', start_time: '08:00:00', end_time: '17:00:00' },
        ],
        error: null,
      });
      tableQueries['assignment_days'] = daysQuery;

      // synced_calendar_events: no existing events for slot reservation
      const syncedQuery = createChainableQuery({ data: [], error: null });
      syncedQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      tableQueries['synced_calendar_events'] = syncedQuery;

      // First day succeeds, second day fails
      mockGraphClient.createCalendarEvent
        .mockResolvedValueOnce({ id: 'created-event-1' })
        .mockRejectedValueOnce(new Error('Rate limited'));

      const result = await fullSyncForUser(TEST_USER_ID);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Rate limited');
    });

    it('handles assignment fetch error', async () => {
      const profilesQuery = createChainableQuery({
        data: { email: TEST_EMAIL },
        error: null,
      });
      tableQueries['profiles'] = profilesQuery;

      setupTableQuery('engineer_outlook_calendars', {
        data: createMockOutlookCalendar(),
        error: null,
      });

      mockGraphClient.getCalendarForUser.mockResolvedValue({
        id: TEST_CALENDAR_ID,
        name: 'AmiDash',
      });

      // project_assignments returns error
      const assignmentsQuery = createChainableQuery({
        data: null,
        error: { message: 'connection error' },
      });
      tableQueries['project_assignments'] = assignmentsQuery;

      const result = await fullSyncForUser(TEST_USER_ID);

      expect(result).toEqual({
        synced: 0,
        failed: 0,
        errors: ['Failed to fetch assignments'],
      });
    });
  });
});
