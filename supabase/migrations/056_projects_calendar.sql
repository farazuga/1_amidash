-- Migration: Add "AmiDash - Projects" calendar support
-- Each user gets a second calendar showing all project assignments globally

-- Add projects calendar ID to engineer_outlook_calendars
ALTER TABLE engineer_outlook_calendars
  ADD COLUMN IF NOT EXISTS outlook_projects_calendar_id text;

-- Add calendar_type to synced_calendar_events to distinguish personal vs projects
ALTER TABLE synced_calendar_events
  ADD COLUMN IF NOT EXISTS calendar_type text NOT NULL DEFAULT 'personal';

-- Drop old unique constraint and create new one including calendar_type
ALTER TABLE synced_calendar_events
  DROP CONSTRAINT IF EXISTS synced_calendar_events_assignment_user_date_key;

ALTER TABLE synced_calendar_events
  ADD CONSTRAINT synced_calendar_events_assignment_user_date_type_key
  UNIQUE (assignment_id, user_id, work_date, calendar_type);

-- Index for efficient lookups by calendar_type
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_type
  ON synced_calendar_events (calendar_type);
