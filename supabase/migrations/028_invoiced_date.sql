-- Invoiced Date Migration
-- Adds invoiced_date column to projects table for tracking when a project was invoiced

-- ============================================
-- 1. Add invoiced_date column
-- ============================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced_date DATE;

-- Index for filtering/sorting by invoiced date
CREATE INDEX IF NOT EXISTS idx_projects_invoiced_date
  ON projects(invoiced_date) WHERE invoiced_date IS NOT NULL;

COMMENT ON COLUMN projects.invoiced_date IS 'Date the project was invoiced. Auto-set when status changes to Invoiced, but can be manually edited.';

-- ============================================
-- 2. Backfill from status history
-- ============================================

-- Set invoiced_date from status_history for existing invoiced projects
UPDATE projects p
SET invoiced_date = (
  SELECT DATE(sh.changed_at)
  FROM status_history sh
  JOIN statuses s ON sh.status_id = s.id
  WHERE sh.project_id = p.id
    AND s.name = 'Invoiced'
  ORDER BY sh.changed_at DESC
  LIMIT 1
)
WHERE p.invoiced_date IS NULL
  AND EXISTS (
    SELECT 1
    FROM status_history sh
    JOIN statuses s ON sh.status_id = s.id
    WHERE sh.project_id = p.id
      AND s.name = 'Invoiced'
  );

-- ============================================
-- 3. Auto-set invoiced_date when status changes to Invoiced
-- ============================================

CREATE OR REPLACE FUNCTION auto_set_invoiced_date()
RETURNS TRIGGER AS $$
DECLARE
  invoiced_status_id UUID;
BEGIN
  -- Get the Invoiced status ID
  SELECT id INTO invoiced_status_id FROM statuses WHERE name = 'Invoiced' LIMIT 1;

  -- If status is changing TO Invoiced and invoiced_date is not set
  IF NEW.current_status_id = invoiced_status_id
     AND (OLD.current_status_id IS NULL OR OLD.current_status_id != invoiced_status_id)
     AND NEW.invoiced_date IS NULL THEN
    NEW.invoiced_date := CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_set_invoiced_date ON projects;
CREATE TRIGGER trigger_auto_set_invoiced_date
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_invoiced_date();
