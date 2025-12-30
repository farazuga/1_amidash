# Microsoft Outlook Calendar Integration Plan

## Overview
Implement real-time calendar sync with Microsoft Outlook using Microsoft Graph API. When assignments are created, updated, or deleted in AmiDash, events will be automatically pushed to the user's connected Outlook calendar.

## Architecture

```
User connects Outlook → OAuth flow → Store tokens in DB
                                          ↓
Assignment created/updated → Trigger sync → Microsoft Graph API → Outlook Calendar
                                          ↓
                              Store event ID mapping for updates/deletes
```

## Implementation Steps

### Phase 1: Database Schema
**File:** `supabase/migrations/XXX_outlook_integration.sql`

```sql
-- Store OAuth connections
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  outlook_email TEXT,
  calendar_id TEXT DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Track synced events for update/delete
CREATE TABLE synced_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES project_assignments(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE NOT NULL,
  external_event_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, connection_id)
);

-- RLS policies
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can manage their own connections
CREATE POLICY "Users can view own connections" ON calendar_connections
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own connections" ON calendar_connections
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own connections" ON calendar_connections
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own connections" ON calendar_connections
  FOR DELETE USING (user_id = auth.uid());
```

### Phase 2: Microsoft Graph Client
**File:** `src/lib/microsoft-graph/client.ts`

- Initialize Microsoft Graph client with access token
- Handle token refresh when expired
- Methods:
  - `createEvent(calendarId, eventData)`
  - `updateEvent(calendarId, eventId, eventData)`
  - `deleteEvent(calendarId, eventId)`
  - `getUserInfo()` - get user's email for display

**File:** `src/lib/microsoft-graph/auth.ts`

- OAuth helper functions
- `getAuthUrl()` - generate OAuth URL with scopes
- `exchangeCodeForTokens(code)` - exchange auth code for tokens
- `refreshAccessToken(refreshToken)` - refresh expired tokens
- Scopes needed: `Calendars.ReadWrite`, `User.Read`, `offline_access`

### Phase 3: OAuth API Routes
**File:** `src/app/api/auth/microsoft/route.ts`
- GET: Redirect to Microsoft OAuth consent page
- Store state param for CSRF protection

**File:** `src/app/api/auth/microsoft/callback/route.ts`
- GET: Handle OAuth callback
- Exchange code for tokens
- Store in calendar_connections table
- Redirect to settings with success/error

### Phase 4: Sync Logic
**File:** `src/lib/microsoft-graph/sync.ts`

```typescript
// Main sync function
async function syncAssignmentToOutlook(
  assignment: ProjectAssignment,
  connection: CalendarConnection
): Promise<void>

// Delete event when assignment removed
async function deleteAssignmentFromOutlook(
  assignmentId: string,
  connectionId: string
): Promise<void>

// Batch sync all assignments for a user
async function fullSyncForUser(userId: string): Promise<void>
```

**Event data mapping:**
- `subject`: Project client_name
- `body`: Status, notes
- `start/end`: Project dates (all-day events)
- `categories`: Based on booking_status color
- `showAs`: 'busy' for confirmed, 'tentative' for others

### Phase 5: Hook into Assignment Actions
**File:** `src/app/(dashboard)/calendar/actions.ts`

Modify existing actions to trigger sync:

1. `createAssignment()` - Add sync call after creation
2. `updateAssignmentStatus()` - Update event in Outlook
3. `removeAssignment()` - Delete event from Outlook
4. `bulkUpdateAssignmentStatus()` - Batch update events

Pattern:
```typescript
// After assignment creation/update
const connections = await getActiveConnections(userId);
for (const conn of connections) {
  await syncAssignmentToOutlook(assignment, conn);
}
```

### Phase 6: Settings UI
**Location:** My Schedule page (`/my-schedule`)
**Scope:** All users can connect their Outlook calendar

**File:** `src/app/(dashboard)/my-schedule/page.tsx` - Add settings section
**File:** `src/components/settings/outlook-connection.tsx` - Connection component

UI elements:
- "Connect Outlook Calendar" button (when not connected)
- Connection status badge (when connected)
- Connected email display
- "Disconnect" button
- "Sync Now" button for manual full sync
- Last sync timestamp

### Phase 7: Environment Variables

```env
MICROSOFT_CLIENT_ID=<from Azure portal>
MICROSOFT_CLIENT_SECRET=<from Azure portal>
MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/auth/microsoft/callback
MICROSOFT_TENANT_ID=common  # or specific tenant
```

## Files to Create/Modify

### New Files:
1. `supabase/migrations/XXX_outlook_integration.sql`
2. `src/lib/microsoft-graph/client.ts`
3. `src/lib/microsoft-graph/auth.ts`
4. `src/lib/microsoft-graph/sync.ts`
5. `src/lib/microsoft-graph/types.ts`
6. `src/app/api/auth/microsoft/route.ts`
7. `src/app/api/auth/microsoft/callback/route.ts`
8. `src/components/settings/outlook-connection.tsx`

### Modified Files:
1. `src/app/(dashboard)/calendar/actions.ts` - Add sync triggers
2. `src/app/(dashboard)/my-schedule/page.tsx` - Add Outlook connection UI section
3. `src/types/database.ts` - Regenerate with new tables

## Dependencies

```bash
npm install @microsoft/microsoft-graph-client @azure/msal-node
```

## Azure Portal Setup (Manual)

1. Go to Azure Portal → Azure Active Directory → App registrations
2. New registration:
   - Name: "AmiDash Calendar Sync"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Web → `https://yourdomain.com/api/auth/microsoft/callback`
3. API permissions → Add:
   - `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access`
4. Certificates & secrets → New client secret
5. Copy: Application (client) ID, Client secret value

## Execution Order

1. Azure Portal setup (manual)
2. Add environment variables
3. Create database migration
4. Implement Microsoft Graph client & auth
5. Create OAuth API routes
6. Implement sync logic
7. Hook into assignment actions
8. Build settings UI
9. Test end-to-end
10. Deploy
