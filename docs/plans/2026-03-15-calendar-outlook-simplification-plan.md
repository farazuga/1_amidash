# Calendar & Outlook Sync Simplification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the calendar system from 4 statuses to 3, replace per-user OAuth with app-level Graph API credentials, sync confirmed assignments as per-day Outlook events to a dedicated "AmiDash" calendar, consolidate 3 calendar views to 2, and add read-only Outlook event display for conflict detection.

**Architecture:** Database migration first (status collapse, new tables), then update all TypeScript types/constants/actions, rewrite Microsoft Graph integration from per-user OAuth to client credentials flow, add Outlook event reading, consolidate calendar views, update tests throughout.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (PostgreSQL), Microsoft Graph API (client credentials), TanStack Query, Zustand, @dnd-kit, Tailwind CSS, shadcn/ui, Vitest, Playwright

**Design doc:** `docs/plans/2026-03-15-calendar-outlook-simplification-design.md`

---

## Phase 1: Database Migration

### Task 1: Write migration to collapse booking statuses (4 → 3)

**Files:**
- Create: `supabase/migrations/048_simplify_booking_statuses.sql`

**Context:** Currently 4 statuses: `draft`, `tentative`, `pending_confirm`, `confirmed`. Collapse `tentative` + `pending_confirm` → `pending`.

**Step 1: Write the migration SQL**

```sql
-- Migration: Collapse tentative + pending_confirm into pending
-- This is a data migration + schema change

BEGIN;

-- 1. Update existing assignments
UPDATE project_assignments
SET booking_status = 'pending'
WHERE booking_status IN ('tentative', 'pending_confirm');

-- 2. Update project schedule_status
UPDATE projects
SET schedule_status = 'pending'
WHERE schedule_status IN ('tentative', 'pending_confirm');

-- 3. Update booking_status_history (preserve old values but update references)
UPDATE booking_status_history
SET new_status = 'pending'
WHERE new_status IN ('tentative', 'pending_confirm');

UPDATE booking_status_history
SET old_status = 'pending'
WHERE old_status IN ('tentative', 'pending_confirm');

-- 4. Update confirmation_requests that are pending
-- (no status field changes needed - they use their own status: pending/confirmed/declined/expired)

-- 5. Drop old CHECK constraint and add new one on project_assignments
ALTER TABLE project_assignments
DROP CONSTRAINT IF EXISTS project_assignments_booking_status_check;

ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_booking_status_check
CHECK (booking_status IN ('draft', 'pending', 'confirmed'));

-- 6. Drop old CHECK constraint and add new one on projects.schedule_status
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS chk_schedule_status_values,
DROP CONSTRAINT IF EXISTS projects_schedule_status_check;

ALTER TABLE projects
ADD CONSTRAINT projects_schedule_status_check
CHECK (schedule_status IN ('draft', 'pending', 'confirmed'));

-- 7. Update the get_next_booking_status RPC function
CREATE OR REPLACE FUNCTION get_next_booking_status(p_current_status TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE p_current_status
    WHEN 'draft' THEN RETURN 'pending';
    WHEN 'pending' THEN RETURN 'confirmed';
    WHEN 'confirmed' THEN RETURN 'draft';
    ELSE RETURN 'draft';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Update is_status_visible_to_engineers
CREATE OR REPLACE FUNCTION is_status_visible_to_engineers(p_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_status IN ('pending', 'confirmed');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
```

**Step 2: Apply migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/048_simplify_booking_statuses.sql
git commit -m "migration: collapse tentative/pending_confirm into pending status"
```

---

### Task 2: Write migration for app-level Outlook integration

**Files:**
- Create: `supabase/migrations/049_app_level_outlook.sql`

**Context:** Replace per-user `calendar_connections` with app-level `engineer_outlook_calendars`. Update `synced_calendar_events` to remove `connection_id` FK.

**Step 1: Write the migration SQL**

```sql
BEGIN;

-- 1. Create table to track the AmiDash calendar created on each engineer's Outlook
CREATE TABLE IF NOT EXISTS engineer_outlook_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outlook_calendar_id TEXT NOT NULL,  -- Graph API calendar ID
  outlook_email TEXT NOT NULL,        -- engineer's org email
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE engineer_outlook_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage outlook calendars"
  ON engineer_outlook_calendars FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view own outlook calendar"
  ON engineer_outlook_calendars FOR SELECT
  USING (user_id = auth.uid());

-- Index
CREATE INDEX idx_engineer_outlook_calendars_user_id ON engineer_outlook_calendars(user_id);

-- Trigger for updated_at
CREATE TRIGGER set_engineer_outlook_calendars_updated_at
  BEFORE UPDATE ON engineer_outlook_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Modify synced_calendar_events: drop connection_id FK, add user_id
ALTER TABLE synced_calendar_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Backfill user_id from calendar_connections before dropping FK
UPDATE synced_calendar_events sce
SET user_id = cc.user_id
FROM calendar_connections cc
WHERE sce.connection_id = cc.id;

-- Drop old FK and column
ALTER TABLE synced_calendar_events
  DROP CONSTRAINT IF EXISTS synced_calendar_events_connection_id_fkey;

ALTER TABLE synced_calendar_events
  DROP COLUMN IF EXISTS connection_id;

-- Add NOT NULL after backfill
ALTER TABLE synced_calendar_events
  ALTER COLUMN user_id SET NOT NULL;

-- Update unique constraint
ALTER TABLE synced_calendar_events
  DROP CONSTRAINT IF EXISTS synced_calendar_events_assignment_id_connection_id_key;

ALTER TABLE synced_calendar_events
  ADD CONSTRAINT synced_calendar_events_assignment_id_user_id_key
  UNIQUE(assignment_id, user_id);

-- New index
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_user_id
  ON synced_calendar_events(user_id);

-- Update RLS for synced_calendar_events
DROP POLICY IF EXISTS "Users can view synced events for their connections" ON synced_calendar_events;

CREATE POLICY "Users can view own synced events"
  ON synced_calendar_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages synced events"
  ON synced_calendar_events FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Drop calendar_connections table (no longer needed)
DROP TABLE IF EXISTS calendar_connections CASCADE;

-- 4. Drop assignment_excluded_dates table (fully deprecated)
DROP TABLE IF EXISTS assignment_excluded_dates CASCADE;

COMMIT;
```

**Step 2: Apply migration locally**

**Step 3: Commit**

```bash
git add supabase/migrations/049_app_level_outlook.sql
git commit -m "migration: add engineer_outlook_calendars, remove calendar_connections"
```

---

### Task 3: Regenerate database types

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Regenerate types**

Run: `npx supabase gen types typescript --local > src/types/database.ts`

**Step 2: Verify no new type errors**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerate database types after migration"
```

---

## Phase 2: Update TypeScript Types, Constants & Validation

### Task 4: Update calendar types

**Files:**
- Modify: `src/types/calendar.ts` (lines 4-5, 10-11, 23-33, 49-55, 64)

**Step 1: Update BookingStatus type**

Replace the `BookingStatus` type union:
```typescript
// Old: 'draft' | 'tentative' | 'pending_confirm' | 'confirmed'
// New:
export type BookingStatus = 'draft' | 'pending' | 'confirmed';
```

**Step 2: Update BOOKING_STATUS_LABELS**

Remove `tentative` and `pending_confirm`, add `pending`:
```typescript
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
};
```

**Step 3: Update BOOKING_STATUS_COLORS**

Remove `tentative`/`pending_confirm` entries, add `pending` with dashed/muted styling info:
```typescript
export const BOOKING_STATUS_COLORS: Record<BookingStatus, { bg: string; text: string; border: string; dot: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
  pending: { bg: 'bg-amber-50/50', text: 'text-amber-700/70', border: 'border-amber-300 border-dashed', dot: 'bg-amber-400' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500' },
};
```

**Step 4: Update BOOKING_STATUS_VISIBILITY**

```typescript
export const BOOKING_STATUS_VISIBILITY: Record<BookingStatus, { visibleToEngineers: boolean }> = {
  draft: { visibleToEngineers: false },
  pending: { visibleToEngineers: true },
  confirmed: { visibleToEngineers: true },
};
```

**Step 5: Update BOOKING_STATUS_CYCLE**

```typescript
export const BOOKING_STATUS_CYCLE: BookingStatus[] = ['draft', 'pending', 'confirmed'];
```

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in files still referencing old statuses (fix in subsequent tasks)

**Step 7: Commit**

```bash
git add src/types/calendar.ts
git commit -m "feat: update BookingStatus type to 3 statuses (draft/pending/confirmed)"
```

---

### Task 5: Update calendar constants

**Files:**
- Modify: `src/lib/calendar/constants.ts` (lines 31-55, 121-133)

**Step 1: Update BOOKING_STATUS_CONFIG**

Remove `tentative` and `pending_confirm` configs. Add `pending` config:
```typescript
pending: {
  label: 'Pending',
  color: 'amber',
  bgColor: 'bg-amber-50/50',
  textColor: 'text-amber-700/70',
  borderColor: 'border-amber-300',
  borderStyle: 'border-dashed',  // NEW: dashed for pending
  opacity: 'opacity-50',          // NEW: 50% opacity for pending
  dotColor: 'bg-amber-400',
  hoverBg: 'hover:bg-amber-100/50',
  description: 'Awaiting customer confirmation',
},
```

**Step 2: Update BOOKING_STATUS_ORDER**

```typescript
export const BOOKING_STATUS_ORDER: BookingStatus[] = ['confirmed', 'pending', 'draft'];
```

**Step 3: Update BOOKING_STATUS_CYCLE**

```typescript
export const BOOKING_STATUS_CYCLE: BookingStatus[] = ['draft', 'pending', 'confirmed'];
```

**Step 4: Run tests**

Run: `npm test -- src/lib/calendar/__tests__/constants.test.ts`
Expected: Failures referencing old statuses — update tests next

**Step 5: Commit**

```bash
git add src/lib/calendar/constants.ts
git commit -m "feat: update calendar constants for 3-status workflow"
```

---

### Task 6: Update validation schemas

**Files:**
- Modify: `src/lib/calendar/validation.ts` (line 9)
- Modify: `src/lib/validation.ts` (lines 35-41)

**Step 1: Update calendar validation**

```typescript
// In src/lib/calendar/validation.ts
export const bookingStatusSchema = z.enum(['draft', 'pending', 'confirmed']);
```

**Step 2: Update shared validation**

```typescript
// In src/lib/validation.ts
export const bookingStatusSchema = z.enum(['draft', 'pending', 'confirmed']);
```

**Step 3: Commit**

```bash
git add src/lib/calendar/validation.ts src/lib/validation.ts
git commit -m "feat: update booking status validation for 3 statuses"
```

---

### Task 7: Update calendar server actions

**Files:**
- Modify: `src/app/(dashboard)/calendar/actions.ts`

**Context:** This is a 2,306-line file. Key changes:

**Step 1: Update status hierarchy/priority logic (~line 259-277)**

Replace the priority object:
```typescript
// Old: { draft: 0, tentative: 1, pending_confirm: 2, confirmed: 3 }
// New:
const STATUS_PRIORITY: Record<BookingStatus, number> = {
  draft: 0,
  pending: 1,
  confirmed: 2,
};
```

**Step 2: Update STATUS_CYCLE (~line 1485-1516)**

```typescript
const STATUS_CYCLE: BookingStatus[] = ['draft', 'pending', 'confirmed'];
```

Remove special-case handling for `pending_confirm` in the cycle function.

**Step 3: Search and replace remaining references**

- Replace all `'tentative'` string literals with `'pending'`
- Replace all `'pending_confirm'` string literals with `'pending'`
- Update any comments referencing old statuses

**Step 4: Run type check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/app/(dashboard)/calendar/actions.ts
git commit -m "feat: update calendar actions for 3-status workflow"
```

---

### Task 8: Update confirmation actions

**Files:**
- Modify: `src/app/(dashboard)/calendar/confirmation-actions.ts`

**Step 1: Update status references**

- Line 148-153: Change validation from checking `tentative` to checking `draft` or `pending` (assignments must be in `pending` state to send confirmation)
- Line 192-207: Status update now goes from `pending` → `pending` (already pending when sent) or `draft` → `pending`
- Line 331: On decline, stay as `pending` (was reverting to `tentative`)
- Line 368, 752-764: Update all `tentative`/`pending_confirm` references to `pending`

**Key behavior change:** When PM clicks "Send to Customer":
- Assignments in `draft` move to `pending`
- Assignments already in `pending` stay `pending`
- On customer confirm: `pending` → `confirmed`
- On customer decline: stays `pending`, PM notified

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/(dashboard)/calendar/confirmation-actions.ts
git commit -m "feat: update confirmation actions for 3-status workflow"
```

---

### Task 9: Update project actions and email templates

**Files:**
- Modify: `src/app/(dashboard)/projects/actions.ts` (line 698)
- Modify: `src/lib/email/templates.ts` (lines 208, 270)

**Step 1: Update valid statuses in project actions**

```typescript
// Old: ['draft', 'tentative', 'pending_confirm', 'confirmed']
const VALID_STATUSES = ['draft', 'pending', 'confirmed'];
```

**Step 2: Update email template status labels**

Replace `pending_confirm: 'Pending Confirmation'` with `pending: 'Pending'`.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/projects/actions.ts src/lib/email/templates.ts
git commit -m "feat: update project actions and email templates for 3 statuses"
```

---

### Task 10: Update unit tests for status changes

**Files:**
- Modify: `src/lib/calendar/__tests__/constants.test.ts`
- Modify: `src/lib/calendar/__tests__/utils.test.ts`
- Modify: `src/app/(dashboard)/calendar/__tests__/actions.test.ts`
- Modify: `src/stores/__tests__/undo-store.test.ts`

**Step 1: Update all test files**

Search for `tentative` and `pending_confirm` in test files. Replace with `pending`. Update test expectations to match 3-status workflow.

**Step 2: Run all tests**

Run: `npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add -A
git commit -m "test: update all tests for 3-status workflow"
```

---

## Phase 3: Microsoft Graph Rewrite (Client Credentials)

### Task 11: Rewrite Microsoft Graph auth for client credentials

**Files:**
- Modify: `src/lib/microsoft-graph/auth.ts` (full rewrite)

**Context:** Replace per-user OAuth (authorization code flow) with app-level client credentials flow. No user interaction needed.

**Step 1: Write failing test**

Create: `src/lib/microsoft-graph/__tests__/auth.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getAppAccessToken } from '../auth';

describe('getAppAccessToken', () => {
  it('should return an access token using client credentials', async () => {
    // Mock fetch for token endpoint
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'mock-app-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    });

    const token = await getAppAccessToken();
    expect(token).toBe('mock-app-token');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/microsoft-graph/__tests__/auth.test.ts`

**Step 3: Rewrite auth.ts**

```typescript
// src/lib/microsoft-graph/auth.ts

const TENANT_ID = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

// Scopes for application permissions (no user context)
const APP_SCOPES = 'https://graph.microsoft.com/.default';

// Cache token in memory (server-side singleton)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  // Return cached token if still valid (5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: APP_SCOPES,
    grant_type: 'client_credentials',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get app token: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// For testing: clear cached token
export function clearTokenCache() {
  cachedToken = null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/microsoft-graph/__tests__/auth.test.ts`

**Step 5: Commit**

```bash
git add src/lib/microsoft-graph/auth.ts src/lib/microsoft-graph/__tests__/auth.test.ts
git commit -m "feat: rewrite Graph auth for client credentials flow"
```

---

### Task 12: Rewrite Microsoft Graph client for app-level access

**Files:**
- Modify: `src/lib/microsoft-graph/client.ts`

**Context:** Replace per-user `getGraphClient(userId)` with app-level client that operates on any user's calendar. Remove token decryption, per-user token refresh. Keep calendar CRUD operations but target specific users.

**Step 1: Write failing test**

Create: `src/lib/microsoft-graph/__tests__/client.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createCalendarForUser, createCalendarEvent, getCalendarEvents } from '../client';

describe('Graph client (app-level)', () => {
  it('should create a calendar for a user by email', async () => {
    // Test that createCalendarForUser calls correct Graph endpoint
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'cal-123', name: 'AmiDash' }),
    });

    const result = await createCalendarForUser('engineer@company.com');
    expect(result.id).toBe('cal-123');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/engineer@company.com/calendars'),
      expect.any(Object)
    );
  });

  it('should create an event on a specific users calendar', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'event-456' }),
    });

    const result = await createCalendarEvent('engineer@company.com', 'cal-123', {
      subject: 'Acme Install',
      start: '2026-03-16T08:30:00',
      end: '2026-03-16T16:30:00',
    });
    expect(result.id).toBe('event-456');
  });

  it('should read events from a users default calendar (read-only)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        value: [
          { id: 'e1', subject: 'Team Meeting', start: {}, end: {}, sensitivity: 'normal' },
          { id: 'e2', subject: 'Doctor', start: {}, end: {}, sensitivity: 'private' },
        ]
      }),
    });

    const events = await getCalendarEvents('engineer@company.com', '2026-03-16', '2026-03-20');
    expect(events).toHaveLength(2);
    // Private events should have subject masked
    expect(events[1].subject).toBe('Private');
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Rewrite client.ts**

Key functions to implement:
- `graphFetch(path, options)` — base fetch wrapper using `getAppAccessToken()`
- `createCalendarForUser(email)` — `POST /users/{email}/calendars` with `{ name: 'AmiDash' }`
- `getCalendarForUser(email, calendarId)` — `GET /users/{email}/calendars/{id}` (verify it exists)
- `createCalendarEvent(email, calendarId, event)` — `POST /users/{email}/calendars/{calendarId}/events`
- `updateCalendarEvent(email, calendarId, eventId, event)` — `PATCH /users/{email}/calendars/{calendarId}/events/{eventId}`
- `deleteCalendarEvent(email, calendarId, eventId)` — `DELETE /users/{email}/calendars/{calendarId}/events/{eventId}`
- `getCalendarEvents(email, startDate, endDate)` — `GET /users/{email}/calendarView` (read-only, for conflict display)
  - Must mask `private`/`confidential` events (replace subject with "Private")
- `getUserByEmail(email)` — `GET /users/{email}` (verify user exists in tenant)

**Step 4: Run tests**

Run: `npm test -- src/lib/microsoft-graph/__tests__/client.test.ts`

**Step 5: Commit**

```bash
git add src/lib/microsoft-graph/client.ts src/lib/microsoft-graph/__tests__/client.test.ts
git commit -m "feat: rewrite Graph client for app-level calendar access"
```

---

### Task 13: Update Microsoft Graph types

**Files:**
- Modify: `src/lib/microsoft-graph/types.ts`

**Step 1: Update types**

Remove `CalendarConnection` interface (no more per-user tokens). Add:

```typescript
export interface EngineerOutlookCalendar {
  id: string;
  user_id: string;
  outlook_calendar_id: string;
  outlook_email: string;
  created_at: string;
  updated_at: string;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'unknown';
  sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
  isFromOutlook: true; // discriminator for UI
}

// Only confirmed assignments sync to Outlook
export const SYNCABLE_STATUSES = ['confirmed'] as const;
```

**Step 2: Commit**

```bash
git add src/lib/microsoft-graph/types.ts
git commit -m "feat: update Graph types for app-level integration"
```

---

### Task 14: Rewrite sync logic

**Files:**
- Modify: `src/lib/microsoft-graph/sync.ts`

**Context:** Major rewrite. Instead of fetching per-user connections, look up engineer's AmiDash calendar from `engineer_outlook_calendars` table. Create calendar on first sync. Only sync `confirmed` assignments (not `pending`).

**Step 1: Write failing test**

Create: `src/lib/microsoft-graph/__tests__/sync.test.ts`

Test key behaviors:
- `syncAssignmentToOutlook()` creates per-day events for confirmed assignments
- `syncAssignmentToOutlook()` does nothing for draft/pending assignments
- `syncAssignmentToOutlook()` deletes events when status moves away from confirmed
- `ensureAmiDashCalendar(userId, email)` creates calendar if not exists, returns cached ID
- `fullSyncForUser(userId)` syncs all confirmed assignments

**Step 2: Implement rewritten sync.ts**

Key changes:
- `ensureAmiDashCalendar(userId, email)` — checks `engineer_outlook_calendars` table, creates via Graph API if missing, stores ID
- `triggerAssignmentSync(assignment)` — only sync if `confirmed`. Delete from Outlook if not `confirmed`.
- `syncAssignmentToOutlook(assignment, userId, email)` — look up AmiDash calendar ID, create/update per-day events (one event per `assignment_day`)
- `deleteAssignmentFromOutlook(assignmentId, userId)` — delete all synced events for this assignment
- `fullSyncForUser(userId)` — fetch all confirmed assignments, sync each
- Remove all `getActiveConnections()` calls
- Remove all `connection_id` references

**Step 3: Run tests**

**Step 4: Commit**

```bash
git add src/lib/microsoft-graph/sync.ts src/lib/microsoft-graph/__tests__/sync.test.ts
git commit -m "feat: rewrite sync for app-level credentials and per-day events"
```

---

### Task 15: Remove per-user OAuth infrastructure

**Files:**
- Delete: `src/app/api/auth/microsoft/route.ts` (OAuth initiation)
- Delete: `src/app/api/auth/microsoft/callback/route.ts` (OAuth callback)
- Delete: `src/app/api/auth/microsoft/disconnect/route.ts` (disconnect)
- Modify: `src/app/api/auth/microsoft/sync/route.ts` (keep, simplify)
- Modify: `src/app/api/auth/microsoft/errors/route.ts` (keep, simplify)
- Modify: `src/app/api/auth/microsoft/retry/route.ts` (keep, simplify)
- Delete: `src/components/settings/outlook-connection.tsx`
- Delete: `src/lib/cron/token-refresh.ts`
- Modify: `src/instrumentation.ts` (remove cron initialization)
- Delete: `src/lib/crypto.ts` (token encryption no longer needed)

**Step 1: Delete OAuth routes**

Remove `route.ts`, `callback/route.ts`, `disconnect/route.ts` from `src/app/api/auth/microsoft/`.

**Step 2: Simplify remaining API routes**

`sync/route.ts` — keep but simplify: get user ID from session, call `fullSyncForUser(userId)`. No connection lookup needed.

`errors/route.ts` — keep but query `synced_calendar_events` by `user_id` instead of `connection_id`.

`retry/route.ts` — keep but simplify: no connection lookup.

**Step 3: Delete outlook-connection component**

Remove `src/components/settings/outlook-connection.tsx` and any imports of it in settings pages.

**Step 4: Delete cron job and crypto**

Remove `src/lib/cron/token-refresh.ts`. Update `src/instrumentation.ts` to remove cron initialization. Remove `src/lib/crypto.ts`.

**Step 5: Remove references**

Search for any remaining imports of deleted files and remove them.

**Step 6: Run type check and tests**

Run: `npx tsc --noEmit && npm test`

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove per-user OAuth infrastructure, simplify API routes"
```

---

### Task 16: Add admin token status route (updated)

**Files:**
- Modify: `src/app/api/admin/token-status/route.ts`

**Step 1: Simplify admin token status**

Replace per-user token health check with a simple app credential health check:
- Attempt `getAppAccessToken()`
- Return status: valid/invalid
- List all engineers with AmiDash calendars and their last sync time

**Step 2: Commit**

```bash
git add src/app/api/admin/token-status/route.ts
git commit -m "feat: update admin token status for app-level credentials"
```

---

## Phase 4: Outlook Event Reading (Read-Only Conflict Display)

### Task 17: Add API route for reading engineer Outlook events

**Files:**
- Create: `src/app/api/calendar/outlook-events/route.ts`

**Step 1: Write the API route**

```typescript
// GET /api/calendar/outlook-events?engineers=id1,id2&start=2026-03-16&end=2026-03-20
// Returns read-only Outlook events for specified engineers in date range
// Only accessible to admin/editor roles

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCalendarEvents } from '@/lib/microsoft-graph/client';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check admin/editor role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'editor'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const engineerIds = searchParams.get('engineers')?.split(',') || [];
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end || engineerIds.length === 0) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Look up engineer emails
  const { data: engineers } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', engineerIds);

  if (!engineers) return NextResponse.json({ events: {} });

  // Fetch Outlook events for each engineer in parallel
  const results: Record<string, OutlookEvent[]> = {};

  await Promise.all(
    engineers.map(async (eng) => {
      try {
        const events = await getCalendarEvents(eng.email, start, end);
        results[eng.id] = events;
      } catch (error) {
        console.error(`Failed to fetch Outlook events for ${eng.email}:`, error);
        results[eng.id] = [];
      }
    })
  );

  return NextResponse.json({ events: results });
}
```

**Step 2: Commit**

```bash
git add src/app/api/calendar/outlook-events/route.ts
git commit -m "feat: add API route for reading engineer Outlook events"
```

---

### Task 18: Add TanStack Query hook for Outlook events

**Files:**
- Create: `src/hooks/queries/use-outlook-events.ts`

**Step 1: Write the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import type { OutlookEvent } from '@/lib/microsoft-graph/types';

interface UseOutlookEventsParams {
  engineerIds: string[];
  startDate: string;  // YYYY-MM-DD
  endDate: string;
  enabled?: boolean;
}

export function useOutlookEvents({ engineerIds, startDate, endDate, enabled = true }: UseOutlookEventsParams) {
  return useQuery<Record<string, OutlookEvent[]>>({
    queryKey: ['outlook-events', engineerIds.sort().join(','), startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        engineers: engineerIds.join(','),
        start: startDate,
        end: endDate,
      });
      const res = await fetch(`/api/calendar/outlook-events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch Outlook events');
      const data = await res.json();
      return data.events;
    },
    enabled: enabled && engineerIds.length > 0,
    staleTime: 5 * 60 * 1000,  // 5 min cache
    refetchOnWindowFocus: false,
  });
}
```

**Step 2: Commit**

```bash
git add src/hooks/queries/use-outlook-events.ts
git commit -m "feat: add useOutlookEvents hook for conflict display"
```

---

## Phase 5: Calendar View Consolidation

### Task 19: Add pending visual styling (dashed borders + opacity)

**Files:**
- Modify: `src/components/calendar/assignment-card.tsx`
- Modify: `src/components/calendar/booking-status-badge.tsx`

**Step 1: Update assignment card**

Add conditional styling for `pending` status:
```typescript
// In assignment card className logic:
const isPending = assignment.booking_status === 'pending';

className={cn(
  'rounded border px-2 py-1',
  isPending && 'opacity-50 border-dashed',
  // ... existing status color logic
)}
```

**Step 2: Update booking status badge**

Ensure badge shows dashed styling for pending.

**Step 3: Verify visually**

Start dev server and verify pending items look dramatically different (muted, dashed, transparent).

**Step 4: Commit**

```bash
git add src/components/calendar/assignment-card.tsx src/components/calendar/booking-status-badge.tsx
git commit -m "feat: add dashed borders and opacity for pending assignments"
```

---

### Task 20: Add pending toggle filter to master calendar

**Files:**
- Modify: `src/app/(dashboard)/calendar/calendar-page-content.tsx`

**Step 1: Add filter state**

```typescript
const [showPending, setShowPending] = useState(true);
```

**Step 2: Add toggle UI**

Add a toggle switch in the calendar header area:
```tsx
<div className="flex items-center gap-2">
  <Switch checked={showPending} onCheckedChange={setShowPending} />
  <Label className="text-sm text-muted-foreground">Show pending</Label>
</div>
```

**Step 3: Filter events**

Filter the calendar events based on toggle state:
```typescript
const filteredEvents = showPending
  ? events
  : events.filter(e => e.booking_status !== 'pending');
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/calendar/calendar-page-content.tsx
git commit -m "feat: add toggle to show/hide pending assignments on calendar"
```

---

### Task 21: Add project/engineer/status filters to master calendar

**Files:**
- Modify: `src/app/(dashboard)/calendar/calendar-page-content.tsx`

**Context:** The project timeline (`/project-calendar`) already has filters (status, tag, engineer). Port similar filtering to the master calendar. Make filters easily accessible — always visible in the header bar.

**Step 1: Add filter state**

```typescript
const [projectFilter, setProjectFilter] = useState<string>('all');
const [engineerFilter, setEngineerFilter] = useState<string>('all');
const [statusFilter, setStatusFilter] = useState<string>('all');
```

**Step 2: Add filter dropdowns**

Use shadcn `Select` components in the calendar header. Populate from existing data:
- Projects: from calendar data (unique project names)
- Engineers: from assignable users query
- Status: `['all', 'draft', 'pending', 'confirmed']`

Include a "Clear filters" button showing active filter count.

**Step 3: Apply filters to events**

```typescript
const filteredEvents = events.filter(event => {
  if (projectFilter !== 'all' && event.project_id !== projectFilter) return false;
  if (engineerFilter !== 'all' && event.user_id !== engineerFilter) return false;
  if (statusFilter !== 'all' && event.booking_status !== statusFilter) return false;
  if (!showPending && event.booking_status === 'pending') return false;
  return true;
});
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/calendar/calendar-page-content.tsx
git commit -m "feat: add project/engineer/status filters to master calendar"
```

---

### Task 22: Display Outlook events on master calendar

**Files:**
- Modify: `src/app/(dashboard)/calendar/calendar-page-content.tsx`
- Create: `src/components/calendar/outlook-event-block.tsx`

**Step 1: Create Outlook event display component**

```typescript
// Non-interactive grey block showing Outlook event
export function OutlookEventBlock({ event }: { event: OutlookEvent }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-500 pointer-events-none select-none">
      <span className="font-medium">{event.subject}</span>
      <span className="ml-1 text-gray-400">
        {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
      </span>
      <span className="ml-1 italic">Outlook</span>
    </div>
  );
}
```

**Step 2: Integrate into calendar**

In the master calendar content, fetch Outlook events for visible engineers using `useOutlookEvents` hook. Render `OutlookEventBlock` components in day cells alongside AmiDash assignment cards. Outlook blocks are non-draggable, non-clickable.

**Step 3: Commit**

```bash
git add src/components/calendar/outlook-event-block.tsx src/app/(dashboard)/calendar/calendar-page-content.tsx
git commit -m "feat: display read-only Outlook events on master calendar"
```

---

### Task 23: Add Outlook conflict warning when assigning

**Files:**
- Modify: `src/components/calendar/assignment-dialog.tsx`
- Modify: `src/components/calendar/conflict-warning-dialog.tsx`

**Step 1: Enhance assignment dialog**

When PM selects an engineer and date range in the assignment dialog, query Outlook events for that engineer/range. Display conflicts inline:

```tsx
{outlookConflicts.length > 0 && (
  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
    <p className="font-medium text-amber-800">Outlook conflicts:</p>
    {outlookConflicts.map(event => (
      <p key={event.id} className="text-amber-700">
        {event.subject} — {formatTime(event.start)} to {formatTime(event.end)}
      </p>
    ))}
    <p className="mt-1 text-xs text-amber-600">You can still assign — this is informational only.</p>
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/calendar/assignment-dialog.tsx src/components/calendar/conflict-warning-dialog.tsx
git commit -m "feat: show Outlook conflicts when assigning engineers"
```

---

### Task 24: Remove per-project calendar page

**Files:**
- Delete: `src/app/(dashboard)/projects/[salesOrder]/calendar/` (entire directory)
- Modify: any navigation links pointing to `/projects/[id]/calendar`

**Step 1: Delete the directory**

Remove `page.tsx`, `project-calendar-content.tsx`, `schedule-status-with-cascade.tsx`, `loading.tsx`.

**Step 2: Update navigation**

Search for links to `/projects/*/calendar` and redirect to `/calendar?project={id}` instead.

**Step 3: Run type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove per-project calendar page, use master calendar filter"
```

---

### Task 25: Simplify My Schedule page

**Files:**
- Modify: `src/app/(dashboard)/my-schedule/page.tsx`
- Modify: `src/app/(dashboard)/my-schedule/my-schedule-content.tsx`

**Step 1: Simplify to confirmed-only list view**

Replace the calendar/list toggle with a simple list:
- Show only `confirmed` assignments
- Display: project name, dates, times, team members, PM contact
- Sorted by date ascending
- Link to project details page
- Note at top: "Your confirmed assignments — these are also on your Outlook calendar"

Remove the calendar grid view from My Schedule (engineers use Outlook for that now).

**Step 2: Commit**

```bash
git add src/app/(dashboard)/my-schedule/
git commit -m "feat: simplify My Schedule to confirmed-only list view"
```

---

### Task 26: Add pending toggle to Project Timeline

**Files:**
- Modify: `src/app/(dashboard)/project-calendar/project-calendar-view.tsx`

**Step 1: Add pending toggle**

Similar to Task 20, add a show/hide pending toggle. The project timeline already has status filters, so also update those to use new 3-status values.

**Step 2: Update status filter options**

Replace old 4-status dropdown with: `All`, `Draft`, `Pending`, `Confirmed`.

**Step 3: Apply pending visual styling to Gantt bars**

Pending project bars should also use dashed borders and reduced opacity.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/project-calendar/project-calendar-view.tsx
git commit -m "feat: add pending toggle and update status filters on project timeline"
```

---

## Phase 6: Cleanup & Final Testing

### Task 27: Remove unused code and env vars

**Files:**
- Modify: `.env.example` or documentation referencing `TOKEN_ENCRYPTION_KEY`
- Remove any remaining imports of deleted modules
- Clean up unused components

**Step 1: Search for dead imports**

Run: `npx tsc --noEmit` and fix all remaining errors.

Search for references to:
- `calendar_connections`
- `CalendarConnection`
- `TOKEN_ENCRYPTION_KEY`
- `outlook-connection`
- `token-refresh`
- `tentative` (should be zero in src/)
- `pending_confirm` (should be zero in src/)

**Step 2: Remove dead code**

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove dead code and unused references"
```

---

### Task 28: Update E2E tests

**Files:**
- Modify: `e2e/calendar.spec.ts`
- Modify: `e2e/calendar-interactions.spec.ts`
- Modify: `e2e/manage-schedule.spec.ts`
- Modify: `e2e/project-calendar.spec.ts`

**Step 1: Update status references**

Replace `tentative`/`pending_confirm` with `pending` in all E2E tests.

**Step 2: Remove tests for deleted per-project calendar page**

**Step 3: Add test for pending toggle**

Test that toggling the pending filter shows/hides pending assignments.

**Step 4: Run E2E tests**

Run: `npm run test:e2e`

**Step 5: Commit**

```bash
git add e2e/
git commit -m "test: update E2E tests for simplified calendar system"
```

---

### Task 29: Update CLAUDE.md documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update booking statuses section**

Replace 4 statuses with 3:
1. **Draft** — PM planning, not visible to engineers
2. **Pending** — Awaiting customer confirmation
3. **Confirmed** — Customer confirmed, syncs to Outlook

**Step 2: Update calendar system section**

Document the 2 views (Master Calendar + Project Timeline), the simplified My Schedule, the app-level Outlook integration, and the read-only Outlook event display.

**Step 3: Update environment variables section**

Remove `TOKEN_ENCRYPTION_KEY`. Note that `MICROSOFT_*` vars are now for app-level client credentials (application permissions, not delegated).

**Step 4: Remove background jobs section about token refresh cron**

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for simplified calendar system"
```

---

### Task 30: Run full test suite and verify

**Step 1: Run all unit tests**

Run: `npm test`
Expected: All pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors (excluding known pre-existing ones)

**Step 3: Run E2E tests**

Run: `npm run test:e2e`

**Step 4: Manual smoke test**

Start dev server and verify:
- [ ] Master calendar loads with filters
- [ ] Pending toggle works
- [ ] Pending items show dashed/transparent
- [ ] Confirmed items show solid
- [ ] Project timeline loads with 3-status filters
- [ ] My Schedule shows simple list
- [ ] Per-project calendar route removed (404)

**Step 5: Final commit if any fixes needed**
