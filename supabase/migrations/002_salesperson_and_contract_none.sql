-- Migration: Add salesperson field and update contract types
-- Run this in your Supabase SQL editor

-- ============================================
-- ADD is_salesperson TO PROFILES
-- ============================================
ALTER TABLE profiles
ADD COLUMN is_salesperson BOOLEAN DEFAULT FALSE;

-- ============================================
-- ADD salesperson_id TO PROJECTS
-- ============================================
ALTER TABLE projects
ADD COLUMN salesperson_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for salesperson lookups
CREATE INDEX idx_projects_salesperson ON projects(salesperson_id);

-- ============================================
-- UPDATE CONTRACT TYPE CHECK CONSTRAINT
-- ============================================
-- First drop the existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_contract_type_check;

-- Add new constraint with 'None' option
ALTER TABLE projects ADD CONSTRAINT projects_contract_type_check
CHECK (contract_type IN (
  'None',
  'South Carolina Purchasing',
  'TIPs Contract',
  'State of Georgia Purchasing Agreement'
));

-- ============================================
-- UPDATE RLS POLICIES FOR DELETE
-- ============================================
-- The delete policy already exists from initial schema, but let's ensure related tables handle cascades properly

-- For status_history, it already has ON DELETE CASCADE for project_id
-- For project_tags, it already has ON DELETE CASCADE for project_id
-- For audit_logs, it already has ON DELETE SET NULL for project_id (keeps the logs)

-- Add policy for notes table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notes') THEN
    -- Notes should cascade delete with project
    EXECUTE 'ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_project_id_fkey';
    EXECUTE 'ALTER TABLE notes ADD CONSTRAINT notes_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE';
  END IF;
END $$;
