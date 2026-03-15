-- Migration: Collapse tentative + pending_confirm into pending
-- This is a data migration + schema change

BEGIN;

-- 1. Update existing assignments
UPDATE project_assignments
SET booking_status = 'pending'
WHERE booking_status IN ('tentative', 'pending_confirm');

-- 2. Update project schedule_status
UPDATE projects
SET schedule_status = 'pending'
WHERE schedule_status IN ('tentative', 'pending_confirm');

-- 3. Update booking_status_history (preserve old values but update references)
UPDATE booking_status_history
SET new_status = 'pending'
WHERE new_status IN ('tentative', 'pending_confirm');

UPDATE booking_status_history
SET old_status = 'pending'
WHERE old_status IN ('tentative', 'pending_confirm');

-- 4. Update confirmation_requests that are pending
-- (no status field changes needed - they use their own status: pending/confirmed/declined/expired)

-- 5. Drop old CHECK constraint and add new one on project_assignments
ALTER TABLE project_assignments
DROP CONSTRAINT IF EXISTS project_assignments_booking_status_check;

ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_booking_status_check
CHECK (booking_status IN ('draft', 'pending', 'confirmed'));

-- 6. Drop old CHECK constraint and add new one on projects.schedule_status
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS chk_schedule_status_values,
DROP CONSTRAINT IF EXISTS projects_schedule_status_check;

ALTER TABLE projects
ADD CONSTRAINT projects_schedule_status_check
CHECK (schedule_status IN ('draft', 'pending', 'confirmed'));

-- 7. Update the get_next_booking_status RPC function
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

-- 8. Update is_status_visible_to_engineers
CREATE OR REPLACE FUNCTION is_status_visible_to_engineers(p_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_status IN ('pending', 'confirmed');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
