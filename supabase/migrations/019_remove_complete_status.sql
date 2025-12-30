-- Migration: Remove 'complete' status from booking workflow
-- The status progression is now: draft -> tentative -> (pending_confirm) -> confirmed
-- 'complete' status is no longer needed as 'confirmed' represents the final state

-- Step 1: Migrate any existing 'complete' assignments to 'confirmed'
UPDATE project_assignments
SET booking_status = 'confirmed'
WHERE booking_status = 'complete';

-- Step 2: Update any history records that reference 'complete'
UPDATE booking_status_history
SET old_status = 'confirmed'
WHERE old_status = 'complete';

UPDATE booking_status_history
SET new_status = 'confirmed'
WHERE new_status = 'complete';

-- Step 3: Drop the old constraint and add the new one
ALTER TABLE project_assignments
DROP CONSTRAINT IF EXISTS project_assignments_booking_status_check;

ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_booking_status_check
CHECK (booking_status IN ('draft', 'tentative', 'pending_confirm', 'confirmed'));

-- Step 4: Update the RPC function for getting next status
CREATE OR REPLACE FUNCTION get_next_booking_status(p_current_status TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE p_current_status
    WHEN 'draft' THEN RETURN 'tentative';
    WHEN 'tentative' THEN RETURN 'confirmed';
    WHEN 'pending_confirm' THEN RETURN 'confirmed';
    WHEN 'confirmed' THEN RETURN 'draft'; -- Cycle back to draft
    ELSE RETURN 'draft';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment documenting the change
COMMENT ON TABLE project_assignments IS 'Project team assignments with 4-status workflow: draft -> tentative -> (pending_confirm) -> confirmed';
