-- Add client_portal_url field to projects table
-- This stores an external URL for the client portal

ALTER TABLE projects ADD COLUMN client_portal_url TEXT;
