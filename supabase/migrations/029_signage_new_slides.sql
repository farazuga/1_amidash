-- Add new slide types to signage_slides table
-- This migration adds 6 new dashboard slide types for enhanced signage display

-- Drop the existing constraint
ALTER TABLE signage_slides DROP CONSTRAINT IF EXISTS valid_slide_type;

-- Add new constraint with all slide types including new dashboard slides
ALTER TABLE signage_slides ADD CONSTRAINT valid_slide_type
  CHECK (slide_type IN (
    -- Original slide types
    'project-list',
    'project-metrics',
    'po-ticker',
    'revenue-dashboard',
    'team-schedule',
    'active-projects',
    -- New dashboard slides
    'health-dashboard',
    'alerts-dashboard',
    'performance-metrics',
    'velocity-chart',
    'status-pipeline',
    'cycle-time'
  ));

-- Insert default configurations for new slide types
-- These slides show dashboard metrics on the digital signage

-- Health Dashboard - Business health overview with gauges
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('health-dashboard', 'Business Health', true, 5, 10000, '{}')
ON CONFLICT DO NOTHING;

-- Alerts Dashboard - Overdue and stuck projects
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('alerts-dashboard', 'Alerts', true, 6, 10000, '{"priorityInsertion": true}')
ON CONFLICT DO NOTHING;

-- Performance Metrics - KPIs like on-time %, DTI, backlog
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('performance-metrics', 'Performance', true, 7, 10000, '{}')
ON CONFLICT DO NOTHING;

-- Velocity Chart - PO intake vs invoice completion trend
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('velocity-chart', 'PO vs Invoice Velocity', true, 8, 10000, '{}')
ON CONFLICT DO NOTHING;

-- Status Pipeline - Project workflow visualization
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('status-pipeline', 'Project Pipeline', true, 9, 10000, '{}')
ON CONFLICT DO NOTHING;

-- Cycle Time - Average time per status stage
INSERT INTO signage_slides (slide_type, title, enabled, display_order, duration_ms, config)
VALUES ('cycle-time', 'Cycle Time Analysis', true, 10, 10000, '{}')
ON CONFLICT DO NOTHING;

-- Add comment documenting slide types
COMMENT ON TABLE signage_slides IS 'Configuration for digital signage slides. Slide types:
- project-list: List of active projects
- project-metrics: Project statistics overview
- po-ticker: Scrolling recent purchase orders
- revenue-dashboard: Revenue metrics and goals
- team-schedule: Team assignment calendar
- active-projects: Active project cards
- health-dashboard: Business health gauges (sales/ops health)
- alerts-dashboard: Overdue and stuck project alerts
- performance-metrics: KPI cards (on-time %, DTI, backlog, concentration)
- velocity-chart: PO vs Invoice velocity bar chart
- status-pipeline: Project workflow funnel visualization
- cycle-time: Average days per status horizontal bar chart';
