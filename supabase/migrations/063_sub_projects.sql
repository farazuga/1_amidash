-- Migration: Add parent-child project relationships for multiple sales orders per project
-- A project can optionally be a child of another project (one level deep only)
-- Children share the parent's SharePoint folder but have independent status, schedule, PO, amount

-- Add parent_project_id column (self-referencing FK)
ALTER TABLE projects ADD COLUMN parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index for fast child lookups
CREATE INDEX idx_projects_parent_project_id ON projects (parent_project_id) WHERE parent_project_id IS NOT NULL;

-- Enforce one-level depth: a project cannot be both parent and child
CREATE OR REPLACE FUNCTION check_sub_project_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_project_id IS NOT NULL THEN
    -- 1. The parent itself must not be a child
    IF EXISTS (
      SELECT 1 FROM projects WHERE id = NEW.parent_project_id AND parent_project_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot create sub-project under another sub-project (max depth is 1)';
    END IF;

    -- 2. This project must not already have children
    IF EXISTS (
      SELECT 1 FROM projects WHERE parent_project_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot make a parent project into a sub-project (it already has children)';
    END IF;

    -- 3. When becoming a child, clear client_token (portal served by parent only)
    IF OLD IS NULL OR OLD.parent_project_id IS NULL OR OLD.parent_project_id IS DISTINCT FROM NEW.parent_project_id THEN
      NEW.client_token := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_sub_project_depth
  BEFORE INSERT OR UPDATE OF parent_project_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION check_sub_project_depth();
