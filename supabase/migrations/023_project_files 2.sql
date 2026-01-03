-- Migration: Project Files & SharePoint Integration
-- Description: Add tables for tracking project files with SharePoint integration
--              Supports pre-PO files (linked to ActiveCampaign deals) and offline capture

-- File category enum for organizing project files
CREATE TYPE file_category AS ENUM ('schematics', 'sow', 'photos', 'videos', 'other');

-- Upload status for tracking offline captures and syncs
CREATE TYPE upload_status AS ENUM ('pending', 'uploading', 'uploaded', 'failed');

-- Store SharePoint folder connections per project
CREATE TABLE IF NOT EXISTS project_sharepoint_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  site_id TEXT NOT NULL,                    -- SharePoint site ID
  drive_id TEXT NOT NULL,                   -- SharePoint drive ID
  folder_id TEXT NOT NULL,                  -- SharePoint folder ID
  folder_path TEXT NOT NULL,                -- Human-readable path (e.g., /Projects/ClientName)
  folder_url TEXT NOT NULL,                 -- Web URL to folder
  connected_by UUID REFERENCES profiles(id) NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,                          -- Last sync error, if any
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)                        -- One SharePoint folder per project
);

-- Pre-sales files: Files captured BEFORE a project exists (during quoting)
-- These are linked to ActiveCampaign Deal ID and moved to project when PO received
CREATE TABLE IF NOT EXISTS presales_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to ActiveCampaign deal (before project exists)
  activecampaign_deal_id TEXT NOT NULL,
  activecampaign_deal_name TEXT,            -- Store deal name for reference

  -- Once project is created, this links them
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- File identification
  file_name TEXT NOT NULL,
  sharepoint_item_id TEXT,                  -- SharePoint file/item ID

  -- File metadata
  category file_category NOT NULL DEFAULT 'other',
  file_size BIGINT,
  mime_type TEXT,
  file_extension TEXT,

  -- URLs
  web_url TEXT,
  download_url TEXT,
  thumbnail_url TEXT,

  -- SharePoint location (PreSales folder)
  sharepoint_folder_path TEXT,              -- e.g., /PreSales/Deal-12345/SOW/

  -- Tracking
  uploaded_by UUID REFERENCES profiles(id),
  upload_status upload_status DEFAULT 'pending',
  upload_error TEXT,

  -- Device info for mobile captures
  captured_on_device TEXT,                  -- 'iPhone', 'iPad', 'web', etc.
  captured_offline BOOLEAN DEFAULT FALSE,   -- True if captured without internet

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track individual files (both uploaded and synced from SharePoint)
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES project_sharepoint_connections(id) ON DELETE SET NULL,

  -- Link to presales file if migrated from pre-PO
  presales_file_id UUID REFERENCES presales_files(id) ON DELETE SET NULL,

  -- File identification
  file_name TEXT NOT NULL,
  sharepoint_item_id TEXT,                  -- SharePoint file/item ID (null if pending upload)

  -- File metadata
  category file_category NOT NULL DEFAULT 'other',
  file_size BIGINT,                         -- Size in bytes
  mime_type TEXT,
  file_extension TEXT,

  -- URLs
  web_url TEXT,                             -- URL to view in SharePoint
  download_url TEXT,                        -- Direct download URL (may expire)
  thumbnail_url TEXT,                       -- Thumbnail for images/videos

  -- Tracking
  uploaded_by UUID REFERENCES profiles(id),
  sharepoint_modified_by TEXT,              -- Email from SharePoint
  sharepoint_modified_at TIMESTAMPTZ,

  -- Project phase when file was added
  project_phase TEXT,                       -- 'quoting', 'engineering', 'onsite', etc.
  notes TEXT,                               -- Optional notes about the file

  -- Upload/Sync status
  upload_status upload_status DEFAULT 'uploaded',
  upload_error TEXT,
  is_synced BOOLEAN DEFAULT FALSE,          -- True if synced from SharePoint
  sync_error TEXT,

  -- Device info for mobile captures
  captured_on_device TEXT,                  -- 'iPhone', 'iPad', 'web', etc.
  captured_offline BOOLEAN DEFAULT FALSE,   -- True if captured without internet
  offline_id TEXT,                          -- Client-generated ID for offline tracking

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track file access/downloads for audit purposes
CREATE TABLE IF NOT EXISTS project_file_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES project_files(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  action TEXT NOT NULL,                     -- 'view', 'download', 'share'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_sharepoint_connections_project_id
  ON project_sharepoint_connections(project_id);

-- Presales files indexes
CREATE INDEX IF NOT EXISTS idx_presales_files_deal_id
  ON presales_files(activecampaign_deal_id);

CREATE INDEX IF NOT EXISTS idx_presales_files_project_id
  ON presales_files(project_id);

CREATE INDEX IF NOT EXISTS idx_presales_files_upload_status
  ON presales_files(upload_status);

-- Project files indexes
CREATE INDEX IF NOT EXISTS idx_project_files_project_id
  ON project_files(project_id);

CREATE INDEX IF NOT EXISTS idx_project_files_category
  ON project_files(category);

CREATE INDEX IF NOT EXISTS idx_project_files_connection_id
  ON project_files(connection_id);

CREATE INDEX IF NOT EXISTS idx_project_files_sharepoint_item_id
  ON project_files(sharepoint_item_id);

CREATE INDEX IF NOT EXISTS idx_project_files_upload_status
  ON project_files(upload_status);

CREATE INDEX IF NOT EXISTS idx_project_files_offline_id
  ON project_files(offline_id);

CREATE INDEX IF NOT EXISTS idx_project_file_access_logs_file_id
  ON project_file_access_logs(file_id);

CREATE INDEX IF NOT EXISTS idx_project_file_access_logs_user_id
  ON project_file_access_logs(user_id);

-- Enable RLS
ALTER TABLE project_sharepoint_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE presales_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_file_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_sharepoint_connections
-- All authenticated users can view connections (project files are team-accessible)
CREATE POLICY "Authenticated users can view connections"
  ON project_sharepoint_connections
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins and the connector can manage connections
CREATE POLICY "Admins can manage connections"
  ON project_sharepoint_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert connections"
  ON project_sharepoint_connections
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for presales_files
-- All authenticated users can view presales files
CREATE POLICY "Authenticated users can view presales files"
  ON presales_files
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert presales files
CREATE POLICY "Authenticated users can insert presales files"
  ON presales_files
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update files they uploaded, admins can update any
CREATE POLICY "Users can update own presales files"
  ON presales_files
  FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can delete files they uploaded, admins can delete any
CREATE POLICY "Users can delete own presales files"
  ON presales_files
  FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for project_files
-- All authenticated users can view files
CREATE POLICY "Authenticated users can view files"
  ON project_files
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert files
CREATE POLICY "Authenticated users can insert files"
  ON project_files
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update files they uploaded, admins can update any
CREATE POLICY "Users can update own files"
  ON project_files
  FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can delete files they uploaded, admins can delete any
CREATE POLICY "Users can delete own files"
  ON project_files
  FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for project_file_access_logs
-- Users can view their own access logs, admins can view all
CREATE POLICY "Users can view own access logs"
  ON project_file_access_logs
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Authenticated users can log their own access
CREATE POLICY "Users can log access"
  ON project_file_access_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_project_sharepoint_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_project_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_sharepoint_connections_updated_at
  BEFORE UPDATE ON project_sharepoint_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_project_sharepoint_connections_updated_at();

CREATE TRIGGER project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_project_files_updated_at();

-- Trigger for presales_files
CREATE OR REPLACE FUNCTION update_presales_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER presales_files_updated_at
  BEFORE UPDATE ON presales_files
  FOR EACH ROW
  EXECUTE FUNCTION update_presales_files_updated_at();

-- Helper function to get file counts by category for a project
CREATE OR REPLACE FUNCTION get_project_file_counts(p_project_id UUID)
RETURNS TABLE (
  category file_category,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pf.category, COUNT(*)::BIGINT
  FROM project_files pf
  WHERE pf.project_id = p_project_id
  GROUP BY pf.category
  ORDER BY pf.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get presales file counts by deal ID
CREATE OR REPLACE FUNCTION get_presales_file_counts(p_deal_id TEXT)
RETURNS TABLE (
  category file_category,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pf.category, COUNT(*)::BIGINT
  FROM presales_files pf
  WHERE pf.activecampaign_deal_id = p_deal_id
  GROUP BY pf.category
  ORDER BY pf.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to link presales files to a project when PO is received
-- This associates existing presales files with the newly created project
CREATE OR REPLACE FUNCTION link_presales_files_to_project(
  p_deal_id TEXT,
  p_project_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  files_linked INTEGER;
BEGIN
  -- Update presales files to link to the project
  UPDATE presales_files
  SET project_id = p_project_id,
      updated_at = NOW()
  WHERE activecampaign_deal_id = p_deal_id
    AND project_id IS NULL;

  GET DIAGNOSTICS files_linked = ROW_COUNT;
  RETURN files_linked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to migrate presales files to project_files table
-- Called after project is created and SharePoint connection is set up
CREATE OR REPLACE FUNCTION migrate_presales_to_project_files(
  p_deal_id TEXT,
  p_project_id UUID,
  p_connection_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  files_migrated INTEGER := 0;
  presales_record RECORD;
BEGIN
  -- First link the presales files to the project
  PERFORM link_presales_files_to_project(p_deal_id, p_project_id);

  -- Then create corresponding project_files entries
  FOR presales_record IN
    SELECT * FROM presales_files
    WHERE activecampaign_deal_id = p_deal_id
      AND project_id = p_project_id
  LOOP
    INSERT INTO project_files (
      project_id,
      connection_id,
      presales_file_id,
      file_name,
      sharepoint_item_id,
      category,
      file_size,
      mime_type,
      file_extension,
      web_url,
      download_url,
      thumbnail_url,
      uploaded_by,
      project_phase,
      notes,
      upload_status,
      is_synced,
      captured_on_device,
      captured_offline
    ) VALUES (
      p_project_id,
      p_connection_id,
      presales_record.id,
      presales_record.file_name,
      presales_record.sharepoint_item_id,
      presales_record.category,
      presales_record.file_size,
      presales_record.mime_type,
      presales_record.file_extension,
      presales_record.web_url,
      presales_record.download_url,
      presales_record.thumbnail_url,
      presales_record.uploaded_by,
      'quoting',  -- These were created during quoting phase
      presales_record.notes,
      presales_record.upload_status,
      TRUE,  -- Already synced to SharePoint
      presales_record.captured_on_device,
      presales_record.captured_offline
    );

    files_migrated := files_migrated + 1;
  END LOOP;

  RETURN files_migrated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get pending upload count for a user (for PWA badge)
CREATE OR REPLACE FUNCTION get_pending_upload_count(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM (
      SELECT id FROM project_files
      WHERE uploaded_by = p_user_id
        AND upload_status IN ('pending', 'uploading')
      UNION ALL
      SELECT id FROM presales_files
      WHERE uploaded_by = p_user_id
        AND upload_status IN ('pending', 'uploading')
    ) combined
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Documentation comments
COMMENT ON TABLE project_sharepoint_connections IS 'Links projects to SharePoint folders for file storage and sync';
COMMENT ON TABLE presales_files IS 'Files captured before a project exists, linked to ActiveCampaign deal ID. Migrated to project_files when PO received.';
COMMENT ON TABLE project_files IS 'Tracks files associated with projects, whether uploaded or synced from SharePoint';
COMMENT ON TABLE project_file_access_logs IS 'Audit log for file views, downloads, and shares';

COMMENT ON COLUMN presales_files.activecampaign_deal_id IS 'ActiveCampaign deal ID - primary identifier before project exists';
COMMENT ON COLUMN presales_files.project_id IS 'Links to project after PO is received and project is created';
COMMENT ON COLUMN presales_files.captured_offline IS 'True if file was captured on mobile without internet connection';

COMMENT ON COLUMN project_files.category IS 'File category: schematics (engineering), sow (quoting), photos (onsite), videos (onsite), other';
COMMENT ON COLUMN project_files.project_phase IS 'Project phase when file was added: quoting, engineering, onsite, etc.';
COMMENT ON COLUMN project_files.is_synced IS 'True if file was synced from SharePoint, false if uploaded directly';
COMMENT ON COLUMN project_files.offline_id IS 'Client-generated UUID for tracking files captured offline before sync';
COMMENT ON COLUMN project_files.captured_offline IS 'True if file was captured on mobile without internet connection';

COMMENT ON COLUMN project_sharepoint_connections.site_id IS 'Microsoft Graph SharePoint site ID';
COMMENT ON COLUMN project_sharepoint_connections.drive_id IS 'Microsoft Graph SharePoint drive ID';
COMMENT ON COLUMN project_sharepoint_connections.folder_id IS 'Microsoft Graph SharePoint folder/item ID';

COMMENT ON FUNCTION link_presales_files_to_project IS 'Associates presales files with a project when PO is received';
COMMENT ON FUNCTION migrate_presales_to_project_files IS 'Copies presales files to project_files table after project creation';
COMMENT ON FUNCTION get_pending_upload_count IS 'Returns count of files pending upload for PWA badge display';
