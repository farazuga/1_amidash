-- Add number_of_vidpods field to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS number_of_vidpods INTEGER;

COMMENT ON COLUMN projects.number_of_vidpods IS 'Number of VidPODs included in the project';
