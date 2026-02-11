-- Add vidpod-sales slide type to signage_slides

-- Drop the existing constraint
ALTER TABLE signage_slides DROP CONSTRAINT IF EXISTS valid_slide_type;

-- Add new constraint with vidpod-sales included
ALTER TABLE signage_slides ADD CONSTRAINT valid_slide_type
  CHECK (slide_type IN (
    -- Original slide types
    'project-list',
    'project-metrics',
    'po-ticker',
    'revenue-dashboard',
    'team-schedule',
    'active-projects',
    -- Dashboard slides
    'health-dashboard',
    'alerts-dashboard',
    'performance-metrics',
    'velocity-chart',
    'status-pipeline',
    'cycle-time',
    -- VidPOD slide
    'vidpod-sales'
  ));

-- Insert default configuration for vidpod-sales slide
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('vidpod-sales', 'VidPOD Sales', true, 11, 10000, '{}')
ON CONFLICT DO NOTHING;
