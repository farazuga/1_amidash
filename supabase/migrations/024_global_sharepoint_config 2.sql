-- Migration: Global SharePoint Configuration
-- Moves SharePoint configuration from per-project to admin-only global setting

-- 1. Add auto_created column to track auto-generated project folders
ALTER TABLE project_sharepoint_connections
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE;

-- 2. Add comment documenting the sharepoint_config structure in app_settings
-- The sharepoint_config key will store:
-- {
--   "site_id": "sharepoint-site-id",
--   "site_name": "Site Display Name",
--   "drive_id": "drive-id",
--   "drive_name": "Documents",
--   "base_folder_id": "folder-id",
--   "base_folder_path": "/Projects",
--   "base_folder_url": "https://...",
--   "configured_by": "user-uuid",
--   "configured_at": "2024-..."
-- }

-- 3. Add RLS policy for all authenticated users to read sharepoint_config
-- (Users need to know if SharePoint is configured to show appropriate UI)
CREATE POLICY "Authenticated users can read sharepoint_config"
ON app_settings
FOR SELECT
TO authenticated
USING (key = 'sharepoint_config');

-- 4. Helper function to get SharePoint config
CREATE OR REPLACE FUNCTION get_sharepoint_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT value
    FROM app_settings
    WHERE key = 'sharepoint_config'
  );
END;
$$;

-- 5. Helper function to check if SharePoint is configured
CREATE OR REPLACE FUNCTION is_sharepoint_configured()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM app_settings
    WHERE key = 'sharepoint_config'
    AND value IS NOT NULL
    AND value != 'null'::jsonb
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_sharepoint_config() TO authenticated;
GRANT EXECUTE ON FUNCTION is_sharepoint_configured() TO authenticated;
