-- Add email notification settings
-- Migration: 007_email_settings.sql

-- Create app_settings table for global settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default email setting (enabled by default)
INSERT INTO app_settings (key, value)
VALUES ('emails_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add email_notifications_enabled column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Enable RLS on app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view app_settings
CREATE POLICY "Admins can view app_settings"
ON app_settings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Policy: Only admins can update app_settings
CREATE POLICY "Admins can update app_settings"
ON app_settings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Policy: Only admins can insert app_settings
CREATE POLICY "Admins can insert app_settings"
ON app_settings FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Create function to get email enabled setting
CREATE OR REPLACE FUNCTION get_emails_enabled()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT (value)::boolean FROM app_settings WHERE key = 'emails_enabled'),
        true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
