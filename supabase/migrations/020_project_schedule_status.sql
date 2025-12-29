-- Project Schedule Status Migration
-- Adds schedule_status column to projects table for calendar color coding
-- Uses same status values as engineer booking_status (draft, tentative, pending_confirm, confirmed)

-- ============================================
-- 1. Add schedule_status column
-- ============================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_status TEXT
  CHECK (schedule_status IS NULL OR schedule_status IN ('draft', 'tentative', 'pending_confirm', 'confirmed'));

-- Constraint: schedule_status can only be set if project has dates
ALTER TABLE projects DROP CONSTRAINT IF EXISTS chk_schedule_status_requires_dates;
ALTER TABLE projects ADD CONSTRAINT chk_schedule_status_requires_dates
  CHECK (schedule_status IS NULL OR (start_date IS NOT NULL AND end_date IS NOT NULL));

-- Index for filtering by schedule status
CREATE INDEX IF NOT EXISTS idx_projects_schedule_status
  ON projects(schedule_status) WHERE schedule_status IS NOT NULL;

COMMENT ON COLUMN projects.schedule_status IS 'Schedule status for calendar display: draft, tentative, pending_confirm, confirmed. NULL until project has dates.';

-- ============================================
-- 2. Auto-set schedule_status when dates are added/removed
-- ============================================

CREATE OR REPLACE FUNCTION auto_set_schedule_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If dates are being set for the first time and schedule_status is null, default to 'draft'
  IF NEW.start_date IS NOT NULL
     AND NEW.end_date IS NOT NULL
     AND (OLD.start_date IS NULL OR OLD.end_date IS NULL)
     AND NEW.schedule_status IS NULL THEN
    NEW.schedule_status := 'draft';
  END IF;

  -- If dates are being cleared, clear schedule_status
  IF (NEW.start_date IS NULL OR NEW.end_date IS NULL) THEN
    NEW.schedule_status := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_set_schedule_status ON projects;
CREATE TRIGGER trigger_auto_set_schedule_status
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_schedule_status();

-- ============================================
-- 3. Backfill existing projects with dates
-- ============================================

-- Set schedule_status to 'draft' for all existing projects that have dates but no status
UPDATE projects
SET schedule_status = 'draft'
WHERE start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND schedule_status IS NULL;
