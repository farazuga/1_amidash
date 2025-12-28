-- Add customer role and email notification preferences
-- Migration: 008_customer_role.sql

-- Step 1: Update profiles.role CHECK constraint to include 'customer'
-- First drop existing constraint if it exists
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with customer role
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('viewer', 'editor', 'admin', 'customer'));

-- Step 2: Create email_notification_preferences table
-- This stores global email preferences per email address
CREATE TABLE IF NOT EXISTS email_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_email_prefs_email ON email_notification_preferences(email);

-- Trigger for updated_at (reuse existing function if available)
DROP TRIGGER IF EXISTS update_email_prefs_updated_at ON email_notification_preferences;
CREATE TRIGGER update_email_prefs_updated_at
  BEFORE UPDATE ON email_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 3: Enable RLS on email_notification_preferences
ALTER TABLE email_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own email preference
CREATE POLICY "Users can view own email preference"
ON email_notification_preferences FOR SELECT
TO authenticated
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Policy: Users can update their own email preference
CREATE POLICY "Users can update own email preference"
ON email_notification_preferences FOR UPDATE
TO authenticated
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Policy: Users can insert their own email preference (for first-time setup)
CREATE POLICY "Users can insert own email preference"
ON email_notification_preferences FOR INSERT
TO authenticated
WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Policy: Admins can view all email preferences
CREATE POLICY "Admins can view all email preferences"
ON email_notification_preferences FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Step 4: Add RLS policy for customers to view their own projects
-- Customers can only see projects where poc_email matches their email
CREATE POLICY "Customers can view their projects"
ON projects FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
    AND LOWER(poc_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Customers can view status history for their projects
CREATE POLICY "Customers can view their project status history"
ON status_history FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
    AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = status_history.project_id
        AND LOWER(p.poc_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
);

-- Customers can view statuses (needed to display status names)
CREATE POLICY "Customers can view statuses"
ON statuses FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
);

-- Customers can view project types (needed for display)
CREATE POLICY "Customers can view project types"
ON project_types FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'customer'
);
