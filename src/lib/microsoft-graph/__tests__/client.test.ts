import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth', () => ({
  getAppAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks are set up
import {
  createCalendarForUser,
  getCalendarForUser,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  buildCalendarEvent,
} from '../client';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function mockOkResponse(body: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function mockErrorResponse(status = 400, message = 'Bad Request') {
  return {
    ok: false,
    status,
    statusText: message,
    json: vi.fn().mockResolvedValue({ error: { message } }),
  };
}

function mock204Response() {
  return { ok: true, status: 204, json: vi.fn() };
}

describe('Microsoft Graph client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createCalendarForUser ───────────────────────────────────
  describe('createCalendarForUser', () => {
    it('POSTs to correct URL and returns calendar', async () => {
      const calendar = { id: 'cal-1', name: 'AmiDash' };
      mockFetch.mockResolvedValueOnce(mockOkResponse(calendar));

      const result = await createCalendarForUser('user@example.com');

      expect(result).toEqual(calendar);
      expect(mockFetch).toHaveBeenCalledWith(
        `${GRAPH_BASE}/users/user@example.com/calendars`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'AmiDash' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal'));

      await expect(createCalendarForUser('user@example.com')).rejects.toThrow(
        'Graph API error 500'
      );
    });
  });

  // ─── getCalendarForUser ──────────────────────────────────────
  describe('getCalendarForUser', () => {
    it('GETs correct URL and returns calendar', async () => {
      const calendar = { id: 'cal-1', name: 'AmiDash' };
      mockFetch.mockResolvedValueOnce(mockOkResponse(calendar));

      const result = await getCalendarForUser('user@example.com', 'cal-1');

      expect(result).toEqual(calendar);
      expect(mockFetch).toHaveBeenCalledWith(
        `${GRAPH_BASE}/users/user@example.com/calendars/cal-1`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });

    it('returns null on error (no throw)', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'));

      const result = await getCalendarForUser('user@example.com', 'bad-id');
      expect(result).toBeNull();
    });
  });

  // ─── createCalendarEvent ─────────────────────────────────────
  describe('createCalendarEvent', () => {
    const event = {
      subject: 'Test',
      start: { dateTime: '2026-03-17T08:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-17T17:00:00', timeZone: 'UTC' },
    };

    it('POSTs event to correct URL and returns created event', async () => {
      const created = { id: 'evt-1' };
      mockFetch.mockResolvedValueOnce(mockOkResponse(created));

      const result = await createCalendarEvent('u@ex.com', 'cal-1', event);

      expect(result).toEqual(created);
      expect(mockFetch).toHaveBeenCalledWith(
        `${GRAPH_BASE}/users/u@ex.com/calendars/cal-1/events`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(event),
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(403, 'Forbidden'));

      await expect(
        createCalendarEvent('u@ex.com', 'cal-1', event)
      ).rejects.toThrow('Graph API error 403');
    });
  });

  // ─── updateCalendarEvent ─────────────────────────────────────
  describe('updateCalendarEvent', () => {
    it('PATCHes correct URL and returns updated event', async () => {
      const updated = { id: 'evt-1' };
      mockFetch.mockResolvedValueOnce(mockOkResponse(updated));

      const result = await updateCalendarEvent('u@ex.com', 'cal-1', 'evt-1', {
        subject: 'Updated',
      });

      expect(result).toEqual(updated);
      expect(mockFetch).toHaveBeenCalledWith(
        `${GRAPH_BASE}/users/u@ex.com/calendars/cal-1/events/evt-1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ subject: 'Updated' }),
        })
      );
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'));

      await expect(
        updateCalendarEvent('u@ex.com', 'cal-1', 'evt-1', {})
      ).rejects.toThrow('Graph API error 404');
    });
  });

  // ─── deleteCalendarEvent ─────────────────────────────────────
  describe('deleteCalendarEvent', () => {
    it('DELETEs correct URL and handles 204 response', async () => {
      mockFetch.mockResolvedValueOnce(mock204Response());

      await deleteCalendarEvent('u@ex.com', 'cal-1', 'evt-1');

      expect(mockFetch).toHaveBeenCalledWith(
        `${GRAPH_BASE}/users/u@ex.com/calendars/cal-1/events/evt-1`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'));

      await expect(
        deleteCalendarEvent('u@ex.com', 'cal-1', 'evt-1')
      ).rejects.toThrow('Graph API error 404');
    });
  });

  // ─── getCalendarEvents ───────────────────────────────────────
  describe('getCalendarEvents', () => {
    it('GETs calendarView with correct query params', async () => {
      const events = [
        {
          id: 'e1',
          subject: 'Meeting',
          start: { dateTime: '2026-03-17T09:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' },
          isAllDay: false,
          showAs: 'busy',
          sensitivity: 'normal',
        },
      ];
      mockFetch.mockResolvedValueOnce(mockOkResponse({ value: events }));

      const result = await getCalendarEvents(
        'u@ex.com',
        '2026-03-17',
        '2026-03-21'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'e1',
          subject: 'Meeting',
          isFromOutlook: true,
        })
      );

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/users/u@ex.com/calendarView?');
      expect(calledUrl).toContain('startDateTime=2026-03-17T00%3A00%3A00Z');
      expect(calledUrl).toContain('endDateTime=2026-03-21T23%3A59%3A59Z');
    });

    it('masks private events', async () => {
      const events = [
        {
          id: 'e1',
          subject: 'Secret Meeting',
          start: { dateTime: '2026-03-17T09:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' },
          isAllDay: false,
          showAs: 'busy',
          sensitivity: 'private',
        },
      ];
      mockFetch.mockResolvedValueOnce(mockOkResponse({ value: events }));

      const result = await getCalendarEvents(
        'u@ex.com',
        '2026-03-17',
        '2026-03-21'
      );

      expect(result[0].subject).toBe('Private');
    });

    it('masks confidential events', async () => {
      const events = [
        {
          id: 'e2',
          subject: 'Top Secret',
          start: { dateTime: '2026-03-17T09:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' },
          isAllDay: false,
          showAs: 'busy',
          sensitivity: 'confidential',
        },
      ];
      mockFetch.mockResolvedValueOnce(mockOkResponse({ value: events }));

      const result = await getCalendarEvents(
        'u@ex.com',
        '2026-03-17',
        '2026-03-21'
      );

      expect(result[0].subject).toBe('Private');
    });

    it('handles error response', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Server Error'));

      await expect(
        getCalendarEvents('u@ex.com', '2026-03-17', '2026-03-21')
      ).rejects.toThrow('Graph API error 500');
    });

    it('returns empty array when value is missing', async () => {
      mockFetch.mockResolvedValueOnce(mockOkResponse({}));

      const result = await getCalendarEvents(
        'u@ex.com',
        '2026-03-17',
        '2026-03-21'
      );

      expect(result).toEqual([]);
    });
  });

  // ─── buildCalendarEvent ──────────────────────────────────────
  describe('buildCalendarEvent', () => {
    it('builds correct event shape', () => {
      const result = buildCalendarEvent({
        projectName: 'Acme Install',
        date: '2026-03-17',
        startTime: '08:00',
        endTime: '17:00',
        teamMembers: ['Alice', 'Bob'],
        pmContact: 'pm@example.com',
        dashboardUrl: 'https://app.example.com/projects/1',
      });

      expect(result.subject).toBe('Acme Install');
      expect(result.start).toEqual({
        dateTime: '2026-03-17T08:00:00',
        timeZone: 'UTC',
      });
      expect(result.end).toEqual({
        dateTime: '2026-03-17T17:00:00',
        timeZone: 'UTC',
      });
      expect(result.showAs).toBe('busy');
      expect(result.isAllDay).toBe(false);
      expect(result.categories).toEqual(['Green category']);
      expect(result.sensitivity).toBe('normal');
    });

    it('includes team members in body', () => {
      const result = buildCalendarEvent({
        projectName: 'Test',
        date: '2026-03-17',
        startTime: '08:00',
        endTime: '17:00',
        teamMembers: ['Alice', 'Bob'],
      });

      expect(result.body?.content).toContain('Alice, Bob');
    });

    it('includes PM contact when provided', () => {
      const result = buildCalendarEvent({
        projectName: 'Test',
        date: '2026-03-17',
        startTime: '08:00',
        endTime: '17:00',
        teamMembers: [],
        pmContact: 'pm@test.com',
      });

      expect(result.body?.content).toContain('pm@test.com');
    });

    it('includes dashboard URL when provided', () => {
      const result = buildCalendarEvent({
        projectName: 'Test',
        date: '2026-03-17',
        startTime: '08:00',
        endTime: '17:00',
        teamMembers: [],
        dashboardUrl: 'https://app.test/p/1',
      });

      expect(result.body?.content).toContain('https://app.test/p/1');
    });

    it('omits optional fields from body when not provided', () => {
      const result = buildCalendarEvent({
        projectName: 'Test',
        date: '2026-03-17',
        startTime: '08:00',
        endTime: '17:00',
        teamMembers: [],
      });

      expect(result.body?.content).not.toContain('PM:');
      expect(result.body?.content).not.toContain('Details:');
      expect(result.body?.content).not.toContain('Team:');
    });

    it('uses text content type for body', () => {
      const result = buildCalendarEvent({
        projectName: 'Test',
        date: '2026-03-17',
        startTime: '08:00',
        endTime: '17:00',
        teamMembers: [],
      });

      expect(result.body?.contentType).toBe('text');
    });
  });
});
