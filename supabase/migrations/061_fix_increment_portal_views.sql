-- Fix increment_portal_views: require the project's client_token to be
-- passed as proof the caller has portal access.
CREATE OR REPLACE FUNCTION increment_portal_views(
  p_project_id UUID,
  p_token UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET client_portal_views = client_portal_views + 1
  WHERE id = p_project_id
    AND client_token = p_token;
END;
$$;
