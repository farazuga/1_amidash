-- Migration: Add 'media' category for combined photos/videos
-- Description: Combines photos and videos into a single 'media' category

-- Add 'media' to file_category enum
ALTER TYPE file_category ADD VALUE IF NOT EXISTS 'media';

-- Migrate existing 'photos' and 'videos' entries to 'media'
-- Note: This must be done in a separate transaction after ALTER TYPE commits
-- For immediate effect, run this after the migration:
-- UPDATE project_files SET category = 'media' WHERE category IN ('photos', 'videos');
-- UPDATE presales_files SET category = 'media' WHERE category IN ('photos', 'videos');

-- Comment update
COMMENT ON COLUMN project_files.category IS 'File category: schematics (engineering), sow (quoting), media (photos/videos), other';
