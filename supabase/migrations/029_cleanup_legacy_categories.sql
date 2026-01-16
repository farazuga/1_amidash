-- Migration: Cleanup legacy file categories
-- Converts 'photos' and 'videos' categories to 'media'

-- Update project_files table
UPDATE project_files
SET category = 'media'
WHERE category IN ('photos', 'videos');

-- Update presales_files table
UPDATE presales_files
SET category = 'media'
WHERE category IN ('photos', 'videos');

-- Note: We cannot remove enum values in PostgreSQL, but they will no longer be used
-- The 'photos' and 'videos' values remain in the enum for backwards compatibility
-- with any existing queries, but new uploads will only use 'media'
