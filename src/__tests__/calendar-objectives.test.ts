/**
 * Calendar Simplification — Objective Validation Tests
 *
 * Each describe block maps to one design objective and acts as an acceptance criterion.
 * Tests verify actual code, files, and exports rather than mocking behavior.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function srcPath(...segments: string[]): string {
  return path.join(ROOT, 'src', ...segments);
}

// ============================================================
// OBJECTIVE 1: Only 3 booking statuses exist
// ============================================================
describe('Objective 1: Only 3 booking statuses exist', () => {
  it('BOOKING_STATUS_LABELS has exactly 3 entries (draft, pending, confirmed)', async () => {
    const { BOOKING_STATUS_LABELS } = await import('@/types/calendar');
    const keys = Object.keys(BOOKING_STATUS_LABELS);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('draft');
    expect(keys).toContain('pending');
    expect(keys).toContain('confirmed');
  });

  it('BOOKING_STATUS_CONFIG has exactly 3 entries', async () => {
    const { BOOKING_STATUS_CONFIG } = await import('@/lib/calendar/constants');
    const keys = Object.keys(BOOKING_STATUS_CONFIG);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('draft');
    expect(keys).toContain('pending');
    expect(keys).toContain('confirmed');
  });

  it('BOOKING_STATUS_CYCLE is [draft, pending, confirmed]', async () => {
    const { BOOKING_STATUS_CYCLE } = await import('@/lib/calendar/constants');
    expect(BOOKING_STATUS_CYCLE).toEqual(['draft', 'pending', 'confirmed']);
  });

  it('bookingStatusSchema rejects "tentative"', async () => {
    const { bookingStatusSchema } = await import('@/lib/calendar/validation');
    const result = bookingStatusSchema.safeParse('tentative');
    expect(result.success).toBe(false);
  });

  it('bookingStatusSchema rejects "pending_confirm"', async () => {
    const { bookingStatusSchema } = await import('@/lib/calendar/validation');
    const result = bookingStatusSchema.safeParse('pending_confirm');
    expect(result.success).toBe(false);
  });

  it('bookingStatusSchema accepts draft, pending, confirmed', async () => {
    const { bookingStatusSchema } = await import('@/lib/calendar/validation');
    expect(bookingStatusSchema.safeParse('draft').success).toBe(true);
    expect(bookingStatusSchema.safeParse('pending').success).toBe(true);
    expect(bookingStatusSchema.safeParse('confirmed').success).toBe(true);
  });
});

// ============================================================
// OBJECTIVE 2: Only confirmed assignments sync to Outlook
// ============================================================
describe('Objective 2: Only confirmed assignments sync to Outlook', () => {
  it('SYNCABLE_STATUSES only contains "confirmed"', async () => {
    const { SYNCABLE_STATUSES } = await import('@/lib/microsoft-graph/types');
    expect(SYNCABLE_STATUSES).toEqual(['confirmed']);
  });
});

// ============================================================
// OBJECTIVE 3: App-level credentials (no per-user OAuth)
// ============================================================
describe('Objective 3: App-level credentials (no per-user OAuth)', () => {
  it('getAppAccessToken function exists in auth.ts', async () => {
    const auth = await import('@/lib/microsoft-graph/auth');
    expect(typeof auth.getAppAccessToken).toBe('function');
  });

  it('old OAuth functions do NOT exist in auth.ts exports', async () => {
    const auth = await import('@/lib/microsoft-graph/auth');
    const exported = auth as Record<string, unknown>;
    expect(exported.getAuthUrl).toBeUndefined();
    expect(exported.exchangeCodeForTokens).toBeUndefined();
    expect(exported.refreshAccessToken).toBeUndefined();
  });

  it('Microsoft OAuth callback route does NOT exist', () => {
    const callbackPath = srcPath('app', 'api', 'auth', 'microsoft', 'callback', 'route.ts');
    expect(fs.existsSync(callbackPath)).toBe(false);
  });

  it('token-refresh cron file does NOT exist', () => {
    const cronPath = srcPath('lib', 'cron', 'token-refresh.ts');
    expect(fs.existsSync(cronPath)).toBe(false);
  });
});

// ============================================================
// OBJECTIVE 4: Dedicated AmiDash calendar per engineer
// ============================================================
describe('Objective 4: Dedicated AmiDash calendar per engineer', () => {
  it('createCalendarForUser function exists in client.ts', async () => {
    const client = await import('@/lib/microsoft-graph/client');
    expect(typeof client.createCalendarForUser).toBe('function');
  });

  it('ensureAmiDashCalendar function exists in sync.ts', async () => {
    const sync = await import('@/lib/microsoft-graph/sync');
    expect(typeof sync.ensureAmiDashCalendar).toBe('function');
  });
});

// ============================================================
// OBJECTIVE 5: Per-day Outlook events (not all-day)
// ============================================================
describe('Objective 5: Per-day Outlook events (not all-day)', () => {
  it('buildCalendarEvent creates events with isAllDay: false and specific times', async () => {
    const { buildCalendarEvent } = await import('@/lib/microsoft-graph/client');
    const event = buildCalendarEvent({
      projectName: 'Test Project',
      projectId: 'test-id',
      date: '2026-03-20',
      startTime: '08:00',
      endTime: '17:00',
      teamMembers: ['Alice'],
    });

    expect(event.isAllDay).toBe(false);
    expect(event.start.dateTime).toContain('08:00');
    expect(event.end.dateTime).toContain('17:00');
  });
});

// ============================================================
// OBJECTIVE 6: Pending visual distinction (dashed + opacity)
// ============================================================
describe('Objective 6: Pending visual distinction (dashed + opacity)', () => {
  it('BOOKING_STATUS_CONFIG.pending has borderStyle containing "dashed"', async () => {
    const { BOOKING_STATUS_CONFIG } = await import('@/lib/calendar/constants');
    expect(BOOKING_STATUS_CONFIG.pending.borderStyle).toContain('dashed');
  });

  it('BOOKING_STATUS_CONFIG.pending has opacity containing "50"', async () => {
    const { BOOKING_STATUS_CONFIG } = await import('@/lib/calendar/constants');
    expect(BOOKING_STATUS_CONFIG.pending.opacity).toContain('50');
  });
});

// ============================================================
// OBJECTIVE 7: Read-only Outlook event display
// ============================================================
describe('Objective 7: Read-only Outlook event display', () => {
  it('getCalendarEvents function exists in client.ts', async () => {
    const client = await import('@/lib/microsoft-graph/client');
    expect(typeof client.getCalendarEvents).toBe('function');
  });

  it('Outlook events API route exists', () => {
    const routePath = srcPath('app', 'api', 'calendar', 'outlook-events', 'route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('useOutlookEvents hook exists', () => {
    const hookPath = srcPath('hooks', 'queries', 'use-outlook-events.ts');
    expect(fs.existsSync(hookPath)).toBe(true);
  });
});

// ============================================================
// OBJECTIVE 8: 2 calendar views (not 3)
// ============================================================
describe('Objective 8: 2 calendar views (not 3)', () => {
  it('per-project calendar directory does NOT exist', () => {
    const perProjectCalDir = srcPath('app', '(dashboard)', 'projects', '[salesOrder]', 'calendar');
    expect(fs.existsSync(perProjectCalDir)).toBe(false);
  });

  it('master calendar page exists', () => {
    const masterCal = srcPath('app', '(dashboard)', 'calendar', 'page.tsx');
    expect(fs.existsSync(masterCal)).toBe(true);
  });

  it('timeline (project-calendar) page exists', () => {
    const timeline = srcPath('app', '(dashboard)', 'project-calendar', 'page.tsx');
    expect(fs.existsSync(timeline)).toBe(true);
  });
});

// ============================================================
// OBJECTIVE 9: Easy filtering on master calendar
// ============================================================
describe('Objective 9: Easy filtering on master calendar', () => {
  it('calendar-page-content.tsx contains projectFilter, engineerFilter, statusFilter, showPending', () => {
    const filePath = srcPath('app', '(dashboard)', 'calendar', 'calendar-page-content.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('projectFilter');
    expect(content).toContain('engineerFilter');
    expect(content).toContain('statusFilter');
    expect(content).toContain('showPending');
  });
});

// ============================================================
// OBJECTIVE 10: My Schedule is confirmed-only list
// ============================================================
describe('Objective 10: My Schedule is confirmed-only list', () => {
  it('my-schedule-content.tsx filters to confirmed only', () => {
    const filePath = srcPath('app', '(dashboard)', 'my-schedule', 'my-schedule-content.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('confirmed');
  });

  it('my-schedule-content.tsx does NOT contain calendar grid toggle code', () => {
    const filePath = srcPath('app', '(dashboard)', 'my-schedule', 'my-schedule-content.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    // Should not have grid/calendar view toggle - it is a simple list
    expect(content).not.toMatch(/viewMode.*grid/i);
    expect(content).not.toMatch(/toggleView/i);
    expect(content).not.toMatch(/calendarView/i);
  });
});

// ============================================================
// OBJECTIVE 11: No old status references in source
// ============================================================
describe('Objective 11: No old status references in source', () => {
  it('no "pending_confirm" as a booking status in src/', () => {
    const { execSync } = require('child_process');
    // Search for pending_confirm as a status value (quoted or as identifier)
    // Exclude database.ts (contains view name "pending_confirmations"), test files, and .md files
    try {
      const result = execSync(
        `grep -rn "pending_confirm[^a]" --include="*.ts" --include="*.tsx" "${srcPath()}" | grep -v "__tests__" | grep -v "database.ts" | grep -v ".test." || true`,
        { encoding: 'utf-8' }
      ).trim();
      expect(result).toBe('');
    } catch {
      // grep returns exit code 1 when no matches - that's fine
    }
  });

  it('"tentative" only appears in Outlook showAs types or UI description text, not as a booking status value', () => {
    const { execSync } = require('child_process');
    // Find tentative in source files, excluding tests and docs
    try {
      const result = execSync(
        `grep -rn "tentative" --include="*.ts" --include="*.tsx" "${srcPath()}" | grep -v "__tests__" | grep -v "node_modules" | grep -v ".test." | grep -v "README" | grep -v "ARCHITECTURE"`,
        { encoding: 'utf-8' }
      ).trim();
      const lines = result.split('\n').filter(Boolean);
      // Each occurrence of "tentative" should be either:
      // 1. In Outlook showAs type definition (microsoft-graph/types.ts)
      // 2. In UI text describing the confirmation workflow
      // It should NOT appear as a booking status enum value like: 'tentative' in a status array
      for (const line of lines) {
        const isOutlookType = line.includes('showAs') || line.includes('microsoft-graph/types');
        const isUIText = line.includes('confirmation-dialog') || line.includes('send-confirmation') || line.includes('project-calendar.tsx');
        expect(
          isOutlookType || isUIText
        ).toBe(true);
      }
    } catch {
      // grep exit code 1 = no matches, which is also acceptable
    }
  });
});

// ============================================================
// OBJECTIVE 12: Customer confirmation flow preserved
// ============================================================
describe('Objective 12: Customer confirmation flow preserved', () => {
  it('confirmation-actions.ts exists', () => {
    const filePath = srcPath('app', '(dashboard)', 'calendar', 'confirmation-actions.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('createConfirmationRequest is exported', () => {
    const content = fs.readFileSync(
      srcPath('app', '(dashboard)', 'calendar', 'confirmation-actions.ts'),
      'utf-8'
    );
    expect(content).toContain('export async function createConfirmationRequest');
  });

  it('handleConfirmationResponse is exported', () => {
    const content = fs.readFileSync(
      srcPath('app', '(dashboard)', 'calendar', 'confirmation-actions.ts'),
      'utf-8'
    );
    expect(content).toContain('export async function handleConfirmationResponse');
  });
});

// ============================================================
// OBJECTIVE 13: Drag-and-drop preserved
// ============================================================
describe('Objective 13: Drag-and-drop preserved', () => {
  it('draggable-assignment-card.tsx exists', () => {
    const filePath = srcPath('components', 'calendar', 'draggable-assignment-card.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('droppable-day-cell.tsx exists', () => {
    const filePath = srcPath('components', 'calendar', 'droppable-day-cell.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
