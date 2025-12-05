-- Add client_portal_views counter to projects table
-- Tracks how many times the client portal page has been viewed

ALTER TABLE projects ADD COLUMN client_portal_views INTEGER DEFAULT 0 NOT NULL;

-- Create RPC function to atomically increment view count
CREATE OR REPLACE FUNCTION increment_portal_views(project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE projects
  SET client_portal_views = client_portal_views + 1
  WHERE id = project_id;
END;
$$;
