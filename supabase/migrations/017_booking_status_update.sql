-- Booking Status Update Migration
-- Migration: 017_booking_status_update.sql
-- Purpose:
--   1. Rename 'pencil' status to 'tentative' for clearer terminology
--   2. Add 'draft' status (PM-only planning, hidden from engineers)
--   3. Add 'complete' status (work finished)
--   4. Update default working hours from 8am-5pm to 7am-4pm

-- ============================================
-- 1. Update booking_status values in project_assignments
-- ============================================

-- Step 1a: Rename 'pencil' to 'tentative' in existing data
UPDATE project_assignments
SET booking_status = 'tentative'
WHERE booking_status = 'pencil';

-- Step 1b: Update history records as well
UPDATE booking_status_history
SET old_status = 'tentative'
WHERE old_status = 'pencil';

UPDATE booking_status_history
SET new_status = 'tentative'
WHERE new_status = 'pencil';

-- Step 2: Drop the existing CHECK constraint
ALTER TABLE project_assignments
DROP CONSTRAINT IF EXISTS project_assignments_booking_status_check;

-- Step 3: Add new CHECK constraint with all 5 statuses
ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_booking_status_check
CHECK (booking_status IN ('draft', 'tentative', 'pending_confirm', 'confirmed', 'complete'));

-- Step 4: Update the default from 'pencil' to 'draft'
ALTER TABLE project_assignments
ALTER COLUMN booking_status SET DEFAULT 'draft';

-- Step 5: Update column comment
COMMENT ON COLUMN project_assignments.booking_status IS
  'Booking workflow status: draft (PM-only), tentative (planned), pending_confirm (sent to customer), confirmed (customer approved), complete (work done)';

-- ============================================
-- 2. Update default working hours in assignment_days
-- ============================================

-- Update default start time from 08:00 to 07:00
ALTER TABLE assignment_days
ALTER COLUMN start_time SET DEFAULT '07:00:00';

-- Update default end time from 17:00 to 16:00
ALTER TABLE assignment_days
ALTER COLUMN end_time SET DEFAULT '16:00:00';

-- Update column comments
COMMENT ON COLUMN assignment_days.start_time IS 'Work start time for this day (default 7:00 AM)';
COMMENT ON COLUMN assignment_days.end_time IS 'Work end time for this day (default 4:00 PM)';

-- ============================================
-- 3. Update RPC functions to handle new statuses
-- ============================================

-- Update get_user_schedule to include new status values
CREATE OR REPLACE FUNCTION get_user_schedule(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  schedule_date DATE,
  project_id UUID,
  project_name TEXT,
  booking_status TEXT,
  assignment_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.work_date,
    p.id,
    p.client_name,
    pa.booking_status,
    pa.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN assignment_days ad ON ad.assignment_id = pa.id
  WHERE pa.user_id = p_user_id
    AND ad.work_date >= p_start_date
    AND ad.work_date <= p_end_date
  ORDER BY ad.work_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_calendar_assignments to include new status values
CREATE OR REPLACE FUNCTION get_calendar_assignments(
  p_start_date DATE,
  p_end_date DATE,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  project_id UUID,
  project_name TEXT,
  user_id UUID,
  user_name TEXT,
  booking_status TEXT,
  project_start_date DATE,
  project_end_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    p.id,
    p.client_name,
    pa.user_id,
    pr.full_name,
    pa.booking_status,
    p.start_date,
    p.end_date
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN profiles pr ON pr.id = pa.user_id
  WHERE p.start_date IS NOT NULL
    AND p.end_date IS NOT NULL
    AND p.start_date <= p_end_date
    AND p.end_date >= p_start_date
    AND (p_project_id IS NULL OR p.id = p_project_id)
  ORDER BY p.start_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Add helper function to check engineer visibility
-- ============================================

-- Function to check if a booking status is visible to engineers
CREATE OR REPLACE FUNCTION is_status_visible_to_engineers(p_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Draft status is only visible to admins/editors (PM)
  -- All other statuses are visible to engineers
  RETURN p_status != 'draft';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_status_visible_to_engineers IS
  'Returns TRUE if the booking status should be visible to engineers (non-admin users)';

-- ============================================
-- 5. Create function to get next status in cycle
-- ============================================

CREATE OR REPLACE FUNCTION get_next_booking_status(p_current_status TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Status cycle: draft -> tentative -> confirmed -> complete -> draft
  -- Note: pending_confirm is skipped in manual cycling (requires confirmation flow)
  CASE p_current_status
    WHEN 'draft' THEN RETURN 'tentative';
    WHEN 'tentative' THEN RETURN 'confirmed';  -- Skip pending_confirm
    WHEN 'pending_confirm' THEN RETURN 'confirmed';
    WHEN 'confirmed' THEN RETURN 'complete';
    WHEN 'complete' THEN RETURN 'draft';
    ELSE RETURN 'draft';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_next_booking_status IS
  'Returns the next status in the booking cycle. Skips pending_confirm as it requires the confirmation flow.';

-- ============================================
-- Migration verification
-- ============================================

DO $$
DECLARE
  pencil_count INTEGER;
  draft_default TEXT;
BEGIN
  -- Verify no 'pencil' status remains
  SELECT COUNT(*) INTO pencil_count
  FROM project_assignments
  WHERE booking_status = 'pencil';

  IF pencil_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records still have pencil status', pencil_count;
  END IF;

  -- Verify default is now 'draft'
  SELECT column_default INTO draft_default
  FROM information_schema.columns
  WHERE table_name = 'project_assignments'
    AND column_name = 'booking_status';

  IF draft_default NOT LIKE '%draft%' THEN
    RAISE WARNING 'Default may not be set correctly: %', draft_default;
  END IF;

  RAISE NOTICE 'Migration 017 completed successfully. Pencil->Tentative migration verified.';
END $$;
