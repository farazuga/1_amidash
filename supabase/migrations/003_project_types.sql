-- Migration: Add project types with status mapping
-- Each project type has a specific set of available statuses

-- ============================================
-- PROJECT TYPES TABLE
-- ============================================
CREATE TABLE project_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT TYPE STATUSES (many-to-many)
-- Maps which statuses are available for each project type
-- ============================================
CREATE TABLE project_type_statuses (
  project_type_id UUID REFERENCES project_types(id) ON DELETE CASCADE,
  status_id UUID REFERENCES statuses(id) ON DELETE CASCADE,
  PRIMARY KEY (project_type_id, status_id)
);

-- ============================================
-- ADD project_type_id TO PROJECTS
-- ============================================
ALTER TABLE projects
ADD COLUMN project_type_id UUID REFERENCES project_types(id) ON DELETE SET NULL;

-- Create index for project type lookups
CREATE INDEX idx_projects_project_type ON projects(project_type_id);

-- ============================================
-- REMOVE progress_percent FROM STATUSES
-- ============================================
ALTER TABLE statuses DROP COLUMN progress_percent;

-- ============================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_type_statuses ENABLE ROW LEVEL SECURITY;

-- PROJECT_TYPES policies
CREATE POLICY "Anyone can view project types" ON project_types
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Public can view project types" ON project_types
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Admins can manage project types" ON project_types
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- PROJECT_TYPE_STATUSES policies
CREATE POLICY "Anyone can view project type statuses" ON project_type_statuses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Public can view project type statuses" ON project_type_statuses
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Admins can manage project type statuses" ON project_type_statuses
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- CREATE DEFAULT PROJECT TYPE
-- ============================================
INSERT INTO project_types (name, display_order, is_active)
VALUES ('Default', 1, true);

-- ============================================
-- ASSIGN ALL EXISTING STATUSES TO DEFAULT TYPE
-- ============================================
INSERT INTO project_type_statuses (project_type_id, status_id)
SELECT
  (SELECT id FROM project_types WHERE name = 'Default'),
  id
FROM statuses;

-- ============================================
-- MIGRATE EXISTING PROJECTS TO DEFAULT TYPE
-- ============================================
UPDATE projects
SET project_type_id = (SELECT id FROM project_types WHERE name = 'Default')
WHERE project_type_id IS NULL;

-- ============================================
-- MAKE project_type_id REQUIRED FOR NEW PROJECTS
-- ============================================
-- Note: We don't add NOT NULL constraint as existing data needs it
-- The application will enforce this requirement
