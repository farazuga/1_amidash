-- Migration: Add synced_project_calendar_events table
-- Tracks project-level date-range events on "AmiDash - Projects" calendars
-- Separate from synced_calendar_events which tracks per-assignment per-day events

CREATE TABLE IF NOT EXISTS synced_project_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  range_start date NOT NULL,
  range_end date NOT NULL,
  external_event_id text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_error text,
  UNIQUE (project_id, user_id, range_start)
);

-- RLS
ALTER TABLE synced_project_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own synced project events"
  ON synced_project_calendar_events FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- Index for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_synced_project_events_user
  ON synced_project_calendar_events (user_id);
CREATE INDEX IF NOT EXISTS idx_synced_project_events_project
  ON synced_project_calendar_events (project_id);
