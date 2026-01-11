-- Migration: Outlook Calendar Per-Day Events with Times
-- Description: Update Outlook sync to create timed events per assignment day
--              instead of all-day events spanning project dates

-- Step 1: Create new table to track synced events per assignment day
-- This allows one Outlook event per day with specific start/end times
CREATE TABLE IF NOT EXISTS synced_calendar_day_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_day_id UUID REFERENCES assignment_days(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE NOT NULL,
  external_event_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_error TEXT,
  UNIQUE(assignment_day_id, connection_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_synced_calendar_day_events_day_id
  ON synced_calendar_day_events(assignment_day_id);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_day_events_connection_id
  ON synced_calendar_day_events(connection_id);

-- Enable RLS
ALTER TABLE synced_calendar_day_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for synced_calendar_day_events
-- Users can view synced events for their connections
CREATE POLICY "Users can view own synced day events" ON synced_calendar_day_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calendar_connections
      WHERE calendar_connections.id = synced_calendar_day_events.connection_id
      AND calendar_connections.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE synced_calendar_day_events IS
  'Tracks which assignment day events have been synced to external calendars with specific times';
COMMENT ON COLUMN synced_calendar_day_events.assignment_day_id IS
  'References the specific scheduled day with start/end times';
COMMENT ON COLUMN synced_calendar_day_events.external_event_id IS
  'The event ID in the external calendar system (Outlook)';

-- Step 2: Update get_user_schedule to include start and end times
CREATE OR REPLACE FUNCTION get_user_schedule(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  schedule_date DATE,
  project_id UUID,
  project_name TEXT,
  sales_order_number TEXT,
  booking_status TEXT,
  assignment_id UUID,
  start_time TIME,
  end_time TIME,
  day_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.work_date,
    p.id,
    p.client_name,
    p.sales_order_number,
    pa.booking_status,
    pa.id,
    ad.start_time,
    ad.end_time,
    ad.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN assignment_days ad ON ad.assignment_id = pa.id
  WHERE pa.user_id = p_user_id
    AND ad.work_date >= p_start_date
    AND ad.work_date <= p_end_date
  ORDER BY ad.work_date, ad.start_time, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_schedule(UUID, DATE, DATE) TO authenticated;
