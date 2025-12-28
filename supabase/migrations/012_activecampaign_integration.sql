-- Active Campaign Integration
-- Migration: 012_activecampaign_integration.sql
-- Adds columns to store Active Campaign account and contact references

-- Add AC account ID column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS activecampaign_account_id TEXT;

-- Add AC contact ID for primary POC
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS activecampaign_contact_id TEXT;

-- Add AC contact ID for secondary POC
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS secondary_activecampaign_contact_id TEXT;

-- Add index for AC account lookups (optional, for future queries)
CREATE INDEX IF NOT EXISTS idx_projects_ac_account_id
ON projects (activecampaign_account_id)
WHERE activecampaign_account_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN projects.activecampaign_account_id IS 'ActiveCampaign account ID for client lookup';
COMMENT ON COLUMN projects.activecampaign_contact_id IS 'ActiveCampaign contact ID for primary POC';
COMMENT ON COLUMN projects.secondary_activecampaign_contact_id IS 'ActiveCampaign contact ID for secondary POC';
