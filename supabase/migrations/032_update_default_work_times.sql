-- Migration: Update default work times to 8:30 AM - 4:30 PM
-- Description: Change default start/end times for assignment_days table

-- Update the default times for new assignment days
ALTER TABLE assignment_days
ALTER COLUMN start_time SET DEFAULT '08:30:00';

ALTER TABLE assignment_days
ALTER COLUMN end_time SET DEFAULT '16:30:00';

-- Add comment explaining the defaults
COMMENT ON COLUMN assignment_days.start_time IS 'Start time for the work day, defaults to 8:30 AM';
COMMENT ON COLUMN assignment_days.end_time IS 'End time for the work day, defaults to 4:30 PM';
