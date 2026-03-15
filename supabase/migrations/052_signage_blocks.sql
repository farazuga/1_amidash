-- Signage Blocks: Replace old signage_slides with a simpler block system
-- Drops the legacy 16-type slide table and introduces blocks + settings

-- ============================================
-- DROP OLD TABLE
-- ============================================

DROP TABLE IF EXISTS signage_slides CASCADE;

-- ============================================
-- SIGNAGE BLOCKS
-- ============================================

CREATE TABLE signage_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type TEXT NOT NULL CHECK (block_type IN ('po-highlight', 'projects-invoiced', 'quick-stats', 'rich-text', 'picture')),
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  position TEXT DEFAULT 'both' CHECK (position IN ('left', 'right', 'both')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_signage_blocks_position_order ON signage_blocks (position, display_order);
CREATE INDEX idx_signage_blocks_enabled ON signage_blocks (enabled);

-- Auto-update trigger (reuses existing function from 001_initial_schema)
CREATE TRIGGER update_signage_blocks_updated_at
  BEFORE UPDATE ON signage_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE signage_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view signage blocks"
  ON signage_blocks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage signage blocks"
  ON signage_blocks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Default blocks
INSERT INTO signage_blocks (block_type, title, enabled, position, display_order) VALUES
  ('quick-stats', 'Quick Stats', true, 'both', 0),
  ('po-highlight', 'PO Highlight', true, 'both', 1),
  ('projects-invoiced', 'Projects Invoiced', true, 'both', 2);

-- ============================================
-- SIGNAGE SETTINGS
-- ============================================

CREATE TABLE signage_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_interval_ms INTEGER DEFAULT 15000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update trigger
CREATE TRIGGER update_signage_settings_updated_at
  BEFORE UPDATE ON signage_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE signage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view signage settings"
  ON signage_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage signage settings"
  ON signage_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Default settings row
INSERT INTO signage_settings (rotation_interval_ms) VALUES (15000);

-- ============================================
-- SIGNAGE IMAGES STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signage-images',
  'signage-images',
  true,
  5242880,  -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload signage images
DROP POLICY IF EXISTS "Authenticated users can upload signage images" ON storage.objects;
CREATE POLICY "Authenticated users can upload signage images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signage-images');

-- Public read access for signage display
DROP POLICY IF EXISTS "Public read access to signage images" ON storage.objects;
CREATE POLICY "Public read access to signage images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'signage-images');

-- Authenticated users can delete signage images
DROP POLICY IF EXISTS "Authenticated users can delete signage images" ON storage.objects;
CREATE POLICY "Authenticated users can delete signage images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'signage-images');
