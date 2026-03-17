-- Migration: App-level Outlook integration
-- Replace per-user calendar_connections with engineer_outlook_calendars
-- NOTE: Must drop RLS policies before dropping connection_id column

-- 1. Create table to track the AmiDash calendar created on each engineer's Outlook
CREATE TABLE IF NOT EXISTS engineer_outlook_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outlook_calendar_id TEXT NOT NULL,
  outlook_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE engineer_outlook_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage outlook calendars"
  ON engineer_outlook_calendars FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view own outlook calendar"
  ON engineer_outlook_calendars FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX idx_engineer_outlook_calendars_user_id ON engineer_outlook_calendars(user_id);

CREATE TRIGGER set_engineer_outlook_calendars_updated_at
  BEFORE UPDATE ON engineer_outlook_calendars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Add user_id to synced_calendar_events
ALTER TABLE synced_calendar_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Backfill user_id from calendar_connections
UPDATE synced_calendar_events sce
SET user_id = cc.user_id
FROM calendar_connections cc
WHERE sce.connection_id = cc.id;

-- Drop ALL existing RLS policies that may reference connection_id
DROP POLICY IF EXISTS "Users can view synced events for their connections" ON synced_calendar_events;
DROP POLICY IF EXISTS "Users can view own synced events" ON synced_calendar_events;
DROP POLICY IF EXISTS "Service role manages synced events" ON synced_calendar_events;

-- Now safe to drop connection_id
ALTER TABLE synced_calendar_events
  DROP CONSTRAINT IF EXISTS synced_calendar_events_connection_id_fkey;

ALTER TABLE synced_calendar_events
  DROP COLUMN IF EXISTS connection_id;

-- Delete orphaned rows and set NOT NULL
DELETE FROM synced_calendar_events WHERE user_id IS NULL;

ALTER TABLE synced_calendar_events
  ALTER COLUMN user_id SET NOT NULL;

-- Update unique constraint
ALTER TABLE synced_calendar_events
  DROP CONSTRAINT IF EXISTS synced_calendar_events_assignment_id_connection_id_key;

ALTER TABLE synced_calendar_events
  ADD CONSTRAINT synced_calendar_events_assignment_id_user_id_key
  UNIQUE(assignment_id, user_id);

CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_user_id
  ON synced_calendar_events(user_id);

-- New RLS policies
CREATE POLICY "Users can view own synced events"
  ON synced_calendar_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages synced events"
  ON synced_calendar_events FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Drop old tables
DROP TABLE IF EXISTS calendar_connections CASCADE;
DROP TABLE IF EXISTS assignment_excluded_dates CASCADE;
