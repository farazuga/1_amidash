-- Amitrace Project Dashboard Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('viewer', 'editor', 'admin')) DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STATUSES TABLE (admin-configurable)
-- ============================================
CREATE TABLE statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_order INT NOT NULL,
  progress_percent INT NOT NULL CHECK (progress_percent >= 0 AND progress_percent <= 100),
  require_note BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAGS TABLE
-- ============================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#023A2D',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT NOT NULL,
  sales_order_number TEXT,
  sales_order_url TEXT,
  po_number TEXT,
  sales_amount DECIMAL(12,2),
  contract_type TEXT CHECK (contract_type IN (
    'South Carolina Purchasing',
    'TIPs Contract',
    'State of Georgia Purchasing Agreement'
  )),
  goal_completion_date DATE,
  current_status_id UUID REFERENCES statuses(id),
  poc_name TEXT,
  poc_email TEXT,
  poc_phone TEXT,
  scope_link TEXT,
  client_token UUID DEFAULT uuid_generate_v4() UNIQUE,
  expected_update_date DATE,
  expected_update_auto BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECT TAGS (many-to-many)
-- ============================================
CREATE TABLE project_tags (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

-- ============================================
-- STATUS HISTORY
-- ============================================
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status_id UUID REFERENCES statuses(id),
  note TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SAVED FILTERS
-- ============================================
CREATE TABLE saved_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_projects_client_name ON projects(client_name);
CREATE INDEX idx_projects_status ON projects(current_status_id);
CREATE INDEX idx_projects_created_date ON projects(created_date);
CREATE INDEX idx_projects_goal_date ON projects(goal_completion_date);
CREATE INDEX idx_projects_client_token ON projects(client_token);
CREATE INDEX idx_projects_contract_type ON projects(contract_type);
CREATE INDEX idx_status_history_project ON status_history(project_id);
CREATE INDEX idx_status_history_changed_at ON status_history(changed_at);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_saved_filters_user ON saved_filters(user_id);

-- Full-text search index
CREATE INDEX idx_projects_search ON projects USING gin(
  to_tsvector('english',
    coalesce(client_name, '') || ' ' ||
    coalesce(sales_order_number, '') || ' ' ||
    coalesce(po_number, '') || ' ' ||
    coalesce(poc_name, '') || ' ' ||
    coalesce(poc_email, '')
  )
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'viewer'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$ language 'sql' SECURITY DEFINER;

-- PROFILES policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- STATUSES policies
CREATE POLICY "Anyone can view statuses" ON statuses
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage statuses" ON statuses
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- TAGS policies
CREATE POLICY "Anyone can view tags" ON tags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tags" ON tags
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- PROJECTS policies
CREATE POLICY "Authenticated users can view projects" ON projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Editors and admins can insert projects" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('editor', 'admin'));

CREATE POLICY "Editors and admins can update projects" ON projects
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('editor', 'admin'));

CREATE POLICY "Admins can delete projects" ON projects
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Public access for client portal (by token)
CREATE POLICY "Public can view project by token" ON projects
  FOR SELECT TO anon
  USING (client_token IS NOT NULL);

-- PROJECT_TAGS policies
CREATE POLICY "Anyone can view project tags" ON project_tags
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Editors and admins can manage project tags" ON project_tags
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('editor', 'admin'));

-- STATUS_HISTORY policies
CREATE POLICY "Anyone can view status history" ON status_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Public can view status history by project token" ON status_history
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = status_history.project_id
      AND p.client_token IS NOT NULL
    )
  );

CREATE POLICY "Editors and admins can insert status history" ON status_history
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('editor', 'admin'));

-- AUDIT_LOGS policies
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- SAVED_FILTERS policies
CREATE POLICY "Users can view own saved filters" ON saved_filters
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own saved filters" ON saved_filters
  FOR ALL TO authenticated
  USING (user_id = auth.uid());
