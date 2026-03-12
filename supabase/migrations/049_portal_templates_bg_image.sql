-- Migration: Add background_image_url to portal_templates
-- This column was added to 048 after initial run; this ensures it exists.
ALTER TABLE portal_templates ADD COLUMN IF NOT EXISTS background_image_url TEXT;
