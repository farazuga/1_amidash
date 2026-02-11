-- Add vidpod_only boolean field to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vidpod_only BOOLEAN DEFAULT false;

COMMENT ON COLUMN projects.vidpod_only IS 'Whether this project is a VidPOD-only project';
