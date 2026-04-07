-- Migration 050: Customer Portal Customization
-- Adds: draft projects, delivery address, email templates, file uploads, approvals, address confirmation

-- ============================================
-- 1. Projects: Draft + Delivery Address
-- ============================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_street text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_zip text,
  ADD COLUMN IF NOT EXISTS delivery_country text DEFAULT 'US';

-- Insert Draft status (grey, internal-only, display_order 0)
INSERT INTO statuses (name, color, display_order, is_active, is_internal_only, require_note, is_exception)
VALUES ('Draft', '#9ca3af', 0, true, true, false, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Portal Email Templates
-- ============================================
CREATE TABLE IF NOT EXISTS portal_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_template_id uuid NOT NULL UNIQUE REFERENCES portal_templates(id) ON DELETE CASCADE,
  primary_color text DEFAULT '#023A2D',
  logo_url text DEFAULT 'https://dash.amitrace.com/new_logo.png',
  footer_text text DEFAULT '',
  button_color text DEFAULT '#023A2D',
  button_text_color text DEFAULT '#ffffff',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE portal_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates"
  ON portal_email_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Editors can view email templates"
  ON portal_email_templates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- ============================================
-- 3. Portal File Uploads
-- ============================================
CREATE TABLE IF NOT EXISTS portal_file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  file_label text NOT NULL,
  file_description text,
  slot_index smallint NOT NULL CHECK (slot_index IN (0, 1)),
  original_filename text,
  stored_filename text,
  file_size_bytes integer,
  mime_type text,
  sharepoint_item_id text,
  sharepoint_web_url text,
  upload_status text NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'approved', 'rejected')),
  rejection_note text,
  uploaded_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE portal_file_uploads ENABLE ROW LEVEL SECURITY;

-- Admins/editors can manage all uploads
CREATE POLICY "Staff can manage file uploads"
  ON portal_file_uploads FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Public read for portal (via service role key in API routes)
-- No direct customer RLS needed - portal API routes use service client

-- ============================================
-- 4. Customer Approval Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS customer_approval_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_upload_id uuid NOT NULL REFERENCES portal_file_uploads(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE customer_approval_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assigned user and admins can manage approval tasks"
  ON customer_approval_tasks FOR ALL
  USING (
    assigned_to = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. Delivery Address Confirmations
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_address_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  confirmed_by_email text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  address_snapshot jsonb NOT NULL
);

ALTER TABLE delivery_address_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view address confirmations"
  ON delivery_address_confirmations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Public insert handled via service role in API route (portal)

-- ============================================
-- 6. App Settings: Customer Approval User
-- ============================================
INSERT INTO app_settings (key, value)
VALUES ('customer_approval_user_id', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
