# Calendar & Outlook Sync Simplification — Design

**Date:** 2026-03-15
**Status:** Approved

## Problem

The current calendar/scheduling system is too complex and doesn't function well. Engineers need a clear system where project assignments appear on their Outlook calendars automatically without confusion.

## Key Decisions

1. **App-level Microsoft Graph permissions** (not per-user OAuth)
2. **Dedicated "AmiDash" calendar** on each engineer's Outlook (never touch default calendar)
3. **3 statuses** instead of 4: Draft → Pending → Confirmed
4. **Only confirmed assignments sync to Outlook** as per-day events
5. **2 calendar views** instead of 3: Master Calendar + Project Timeline
6. **Read engineers' Outlook events** (read-only) to show conflicts on master calendar
7. **Customer confirmation flow kept** but streamlined

---

## Status Workflow (3 statuses)

| Status | Meaning | Visible to engineers | Syncs to Outlook |
|--------|---------|---------------------|-----------------|
| **Draft** | PM is planning | No | No |
| **Pending** | Sent to customer, awaiting confirmation | Yes (muted, dashed borders, 50% opacity) | No |
| **Confirmed** | Customer confirmed | Yes (solid, bold) | Yes |

### Transitions

- Draft → Pending: PM sends confirmation link to customer
- Pending → Confirmed: Customer confirms via link, or PM manually confirms
- Confirmed → Draft: PM needs to reschedule (removes from Outlook)

### Customer Confirmation Flow

- PM manually clicks "Send to Customer" — sends email with schedule link
- PM dashboard shows: sent date, customer email, response status, expiry
- Customer clicks link → sees schedule → confirms or declines
- On confirm → assignments auto-move to Confirmed → sync to Outlook
- On decline → stays Pending, PM notified with reason

---

## Outlook Integration (redesigned)

### Architecture: App-Level Credentials

| Current | New |
|---------|-----|
| Each engineer connects their own Microsoft account | Single app registration with admin-consented application permissions |
| N OAuth tokens to manage | 1 client credential flow |
| Per-user token refresh cron | Single token, auto-refreshes on use |
| Engineers must opt in | All engineers get events automatically |

### Dedicated "AmiDash" Calendar

- On first sync for an engineer, create a calendar named "AmiDash" on their account
- All events written only to this calendar — never touches default calendar
- Engineer can toggle visibility, change color in Outlook
- If something goes wrong, delete the calendar = clean slate
- Calendar IDs tracked in database

### Event Creation (confirmed assignments only)

- One Outlook event per `assignment_day` record
- Event shows: project name, times (e.g., 8:30-4:30), location if available
- Event body includes: team members, PM contact, link back to AmiDash My Schedule page
- `showAs: busy` so it blocks their availability

### Sync Triggers

- Assignment moves to Confirmed → create events for all assignment_days
- Assignment moved back to Draft → delete all events
- PM changes a confirmed assignment's days/times → update events
- Assignment deleted → delete events

### Safety Guardrails

- App only writes to calendar IDs it created (tracked in DB)
- Delete by specific event ID only, never bulk delete
- Idempotent sync via `synced_calendar_events` mapping table
- All sync operations logged for debugging
- Respect Outlook `private`/`confidential` sensitivity flags when reading

### Reading Engineer Outlook Events (read-only)

- App reads events from engineers' default calendar via Graph API
- Displayed as non-interactive grey blocks on master calendar
- Shows: event title, time, "Outlook" label
- PM cannot edit, move, or delete these — purely visual
- Events marked private in Outlook show as "Private" (no title)
- Only PMs/admins see other engineers' Outlook events
- Fetched on-demand, cached briefly (5-10 min)
- When PM assigns an engineer, show conflict warning with event details
- PM can override conflicts

---

## Calendar Views (consolidated from 3 → 2)

### View 1: Master Calendar (`/calendar`)

- **Purpose:** "Who is where on what day" — daily scheduling
- **Layout:** Month grid (weekdays only) with week view option
- **Shows:** Engineer assignments as colored blocks + grey Outlook events (read-only)
- **Filters:** By engineer, project, status — easy to access, always visible
- **Toggle:** Show/hide pending items
- **Pending visual:** Dashed borders, 50% opacity
- **Confirmed visual:** Solid borders, full opacity, bold
- **Interactions:** Drag-and-drop (move, Cmd+drag copy, Option+click delete), click to assign via dialog, Cmd+Z undo
- **Outlook conflict warnings** shown inline

### View 2: Project Timeline (`/project-calendar`)

- **Purpose:** "Big picture across all projects" — multi-month planning
- **Layout:** Gantt-style horizontal timeline, projects as rows
- **Shows:** Project bars colored by status, with engineer names
- **Filters:** By status, tags, engineer
- **Toggle:** Show/hide pending items
- **Interactions:** Drag project bars to reschedule
- **No Outlook events** — project-level view only

### Removed: Per-Project Calendar (`/projects/[id]/calendar`)

- Replaced by filtering master calendar by project
- "Manage Schedule" dialog handles detailed per-project engineer scheduling (table-based view for assigning engineers, picking dates/times)

### My Schedule (`/my-schedule`) — simplified for engineers

- Simple list of upcoming confirmed assignments
- Shows: project name, dates, times, team members, PM contact
- Outlook events link back here for details
- No calendar grid, no drag-and-drop

---

## What Gets Removed

| Feature | Reason |
|---------|--------|
| Per-user OAuth connection flow | Replaced by app-level credentials |
| OAuth connect/disconnect UI in settings | No longer needed |
| Per-user token refresh cron (4-hour cycle) | Single client credential |
| `calendar_connections` table (per-user tokens) | Replaced by env var config |
| Per-project calendar page | Filter master calendar instead |
| `assignment_excluded_dates` table | Already deprecated, fully remove |
| `tentative` status | Merged with `pending_confirm` into `Pending` |
| Status cycling via click | Explicit actions: "Send to Customer" or "Confirm" |

## What Gets Simplified

| Feature | Current | New |
|---------|---------|-----|
| Outlook events | 1 all-day event per project | 1 event per assignment_day with actual times |
| Status workflow | 4 statuses | 3 statuses |
| Calendar views | 3 pages | 2 pages + simple list |
| Token management | N encrypted tokens + cron | 1 client credential in env |
| Sync target | User's default calendar | Dedicated "AmiDash" calendar |

## What Stays As-Is

- Drag-and-drop (move, copy, delete interactions)
- `assignment_days` model (per-day times)
- Conflict detection + override
- Undo system (Cmd+Z)
- Booking status history / audit trail
- User availability (PTO, training, sick)
- "Manage Schedule" dialog for table-based editing

---

## Database Changes Needed

1. **New: `engineer_outlook_calendars`** — track the AmiDash calendar ID created on each engineer's Outlook account
2. **Modify: `synced_calendar_events`** — update to reference per-day events instead of per-project events; remove `connection_id` FK (no longer per-user connections)
3. **Modify: `project_assignments.booking_status`** — collapse `tentative` + `pending_confirm` into `pending`
4. **Remove: `calendar_connections`** — no longer needed (app-level auth)
5. **Remove: `assignment_excluded_dates`** — fully deprecated
6. **New env vars:** `MICROSOFT_APP_CLIENT_ID`, `MICROSOFT_APP_CLIENT_SECRET`, `MICROSOFT_APP_TENANT_ID` (for client credentials flow)

## Azure AD Setup Required

1. Register (or update) app in Azure AD
2. Add application permissions: `Calendars.ReadWrite`, `User.Read.All`
3. Admin grants consent for the tenant
4. Generate client secret
5. Configure env vars
