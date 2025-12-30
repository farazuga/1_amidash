-- Add dashboard threshold settings
-- Migration: 023_dashboard_settings.sql

-- Insert default dashboard settings
-- These control the thresholds used in the dashboard health diagnostics

-- WIP Aging threshold (days a project can stay in a status before being flagged as "stuck")
INSERT INTO app_settings (key, value)
VALUES ('dashboard_wip_aging_days', '14'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Sales health threshold (% of goal - below this is flagged as needing attention)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_sales_health_threshold', '80'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Operations health threshold (% completion ratio - below this is flagged as bottleneck)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_operations_health_threshold', '60'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- On-time completion good threshold (% - at or above is green)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_ontime_good_threshold', '80'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- On-time completion warning threshold (% - below good but at or above this is amber)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_ontime_warning_threshold', '60'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Customer concentration high risk threshold (% - at or above is high risk)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_concentration_high_threshold', '70'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Customer concentration medium risk threshold (% - at or above is medium risk)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_concentration_medium_threshold', '50'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Backlog depth warning threshold (months - above this shows warning)
INSERT INTO app_settings (key, value)
VALUES ('dashboard_backlog_warning_months', '6'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Policy for all authenticated users to read dashboard settings (needed for dashboard to work)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'app_settings'
        AND policyname = 'Authenticated users can view dashboard settings'
    ) THEN
        CREATE POLICY "Authenticated users can view dashboard settings"
        ON app_settings FOR SELECT
        TO authenticated
        USING (key LIKE 'dashboard_%');
    END IF;
END
$$;
