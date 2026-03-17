-- Migration: Add work_date column to synced_calendar_events
-- The sync logic creates one Outlook event per assignment day,
-- so we need work_date to track which day each synced event corresponds to.

-- 1. Add work_date column
ALTER TABLE synced_calendar_events
  ADD COLUMN IF NOT EXISTS work_date DATE;

-- 2. Drop old unique constraint (assignment_id, user_id)
ALTER TABLE synced_calendar_events
  DROP CONSTRAINT IF EXISTS synced_calendar_events_assignment_id_user_id_key;

-- 3. Clean up any existing rows (they were from failed syncs anyway)
DELETE FROM synced_calendar_events WHERE work_date IS NULL;

-- 4. Set NOT NULL after cleanup
ALTER TABLE synced_calendar_events
  ALTER COLUMN work_date SET NOT NULL;

-- 5. Add new unique constraint including work_date
ALTER TABLE synced_calendar_events
  ADD CONSTRAINT synced_calendar_events_assignment_user_date_key
  UNIQUE(assignment_id, user_id, work_date);

-- 6. Index for efficient lookups by user + date range
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_work_date
  ON synced_calendar_events(work_date);
