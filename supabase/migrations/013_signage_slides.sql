-- Create signage_slides table for storing slide configuration
CREATE TABLE signage_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_type TEXT NOT NULL,
  title TEXT,
  enabled BOOLEAN DEFAULT true,
  display_order INTEGER NOT NULL,
  duration_ms INTEGER DEFAULT 15000,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add check constraint for valid slide types
ALTER TABLE signage_slides ADD CONSTRAINT valid_slide_type
  CHECK (slide_type IN ('project-list', 'project-metrics', 'po-ticker', 'revenue-dashboard', 'team-schedule'));

-- Create index for ordering
CREATE INDEX idx_signage_slides_order ON signage_slides (display_order);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_signage_slides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signage_slides_updated_at
  BEFORE UPDATE ON signage_slides
  FOR EACH ROW
  EXECUTE FUNCTION update_signage_slides_updated_at();

-- Enable RLS
ALTER TABLE signage_slides ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read slides
CREATE POLICY "Authenticated users can view signage slides"
  ON signage_slides
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can modify slides
CREATE POLICY "Admins can manage signage slides"
  ON signage_slides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default slides
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config) VALUES
  ('project-list', 'Active Projects', true, 1, 15000, '{"maxItems": 15}'),
  ('project-metrics', 'Project Metrics', true, 2, 12000, '{}'),
  ('po-ticker', 'Recent Purchase Orders', true, 3, 20000, '{"scrollSpeed": 2}'),
  ('revenue-dashboard', 'Revenue Dashboard', true, 4, 15000, '{}');

-- Grant access to service role for signage engine
GRANT SELECT ON signage_slides TO service_role;
