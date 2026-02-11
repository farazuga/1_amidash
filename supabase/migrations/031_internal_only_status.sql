-- Add is_internal_only flag to statuses table
-- Internal-only statuses are hidden from client-facing portals
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN DEFAULT FALSE;
