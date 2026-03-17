-- Migration: Collapse tentative + pending_confirm into pending
-- This is a data migration + schema change
-- NOTE: Constraints must be dropped BEFORE updating data

-- Step 1: Drop old CHECK constraints FIRST
ALTER TABLE project_assignments
DROP CONSTRAINT IF EXISTS project_assignments_booking_status_check;

ALTER TABLE projects
DROP CONSTRAINT IF EXISTS chk_schedule_status_values,
DROP CONSTRAINT IF EXISTS projects_schedule_status_check;

-- Step 2: Update data now that constraints are removed
UPDATE project_assignments
SET booking_status = 'pending'
WHERE booking_status IN ('tentative', 'pending_confirm');

UPDATE projects
SET schedule_status = 'pending'
WHERE schedule_status IN ('tentative', 'pending_confirm');

UPDATE booking_status_history
SET new_status = 'pending'
WHERE new_status IN ('tentative', 'pending_confirm');

UPDATE booking_status_history
SET old_status = 'pending'
WHERE old_status IN ('tentative', 'pending_confirm');

-- Step 3: Add new CHECK constraints
ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_booking_status_check
CHECK (booking_status IN ('draft', 'pending', 'confirmed'));

ALTER TABLE projects
ADD CONSTRAINT projects_schedule_status_check
CHECK (schedule_status IN ('draft', 'pending', 'confirmed'));

-- Step 4: Update RPC functions
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

CREATE OR REPLACE FUNCTION is_status_visible_to_engineers(p_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_status IN ('pending', 'confirmed');
END;
$$ LANGUAGE plpgsql IMMUTABLE;
