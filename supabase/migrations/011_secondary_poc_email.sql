-- Add secondary POC email for customer association
-- Migration: 011_secondary_poc_email.sql

-- Step 1: Add secondary_poc_email column to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS secondary_poc_email TEXT;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_projects_secondary_poc_email
ON projects (LOWER(secondary_poc_email))
WHERE secondary_poc_email IS NOT NULL;

-- Step 2: Update RLS policy for customers to also match secondary_poc_email
-- First drop the existing policy
DROP POLICY IF EXISTS "Customers can view their projects" ON projects;

-- Recreate with secondary email support
CREATE POLICY "Customers can view their projects"
ON projects FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
    AND (
        LOWER(poc_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        OR LOWER(secondary_poc_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
);

-- Step 3: Update status history policy for secondary email
DROP POLICY IF EXISTS "Customers can view their project status history" ON status_history;

CREATE POLICY "Customers can view their project status history"
ON status_history FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = status_history.project_id
        AND (
            LOWER(p.poc_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
            OR LOWER(p.secondary_poc_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    )
);
