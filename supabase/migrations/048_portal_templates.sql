-- Migration: Add portal templates for customizable customer status pages
-- Each project type can be assigned a portal template that defines
-- which blocks are shown and in what order on the customer-facing status page.

-- ============================================
-- PORTAL TEMPLATES TABLE
-- ============================================
CREATE TABLE portal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD portal_template_id TO PROJECT_TYPES
-- ============================================
ALTER TABLE project_types
ADD COLUMN portal_template_id UUID REFERENCES portal_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_project_types_portal_template ON project_types(portal_template_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE portal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view portal templates" ON portal_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Public can view portal templates" ON portal_templates
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Admins can manage portal templates" ON portal_templates
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- SEED DEFAULT TEMPLATE
-- ============================================
INSERT INTO portal_templates (name, blocks, is_default)
VALUES (
  'Default',
  '[
    {"id": "blk_status_default", "type": "current_status"},
    {"id": "blk_poc_default", "type": "poc_info"},
    {"id": "blk_history_default", "type": "status_history"}
  ]'::jsonb,
  true
);

-- ============================================
-- ASSIGN DEFAULT TEMPLATE TO ALL EXISTING TYPES
-- ============================================
UPDATE project_types
SET portal_template_id = (SELECT id FROM portal_templates WHERE is_default = true)
WHERE portal_template_id IS NULL;
