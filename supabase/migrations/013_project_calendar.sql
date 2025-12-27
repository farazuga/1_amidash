-- Project Calendar/Scheduling Feature
-- Migration: 013_project_calendar.sql
-- Adds calendar and assignment functionality for project scheduling

-- ============================================
-- 1. Add project date columns
-- ============================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add constraint: end_date >= start_date
ALTER TABLE projects DROP CONSTRAINT IF EXISTS chk_project_dates;
ALTER TABLE projects ADD CONSTRAINT chk_project_dates
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- Add indexes for date queries
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date) WHERE end_date IS NOT NULL;

COMMENT ON COLUMN projects.start_date IS 'Project start date for calendar scheduling';
COMMENT ON COLUMN projects.end_date IS 'Project end date for calendar scheduling';

-- ============================================
-- 2. Create project_assignments table
-- ============================================

CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_status TEXT NOT NULL CHECK (booking_status IN ('pencil', 'pending_confirm', 'confirmed')) DEFAULT 'pencil',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_status ON project_assignments(booking_status);

COMMENT ON TABLE project_assignments IS 'Tracks user assignments to projects for calendar scheduling';
COMMENT ON COLUMN project_assignments.booking_status IS 'pencil=tentative, pending_confirm=awaiting confirmation, confirmed=finalized';

-- ============================================
-- 3. Create assignment_excluded_dates table
-- ============================================

CREATE TABLE IF NOT EXISTS assignment_excluded_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  excluded_date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, excluded_date)
);

CREATE INDEX IF NOT EXISTS idx_excluded_dates_assignment ON assignment_excluded_dates(assignment_id);
CREATE INDEX IF NOT EXISTS idx_excluded_dates_date ON assignment_excluded_dates(excluded_date);

COMMENT ON TABLE assignment_excluded_dates IS 'Days excluded from an assignment (user not working that day)';

-- ============================================
-- 4. Create booking_conflicts table
-- ============================================

CREATE TABLE IF NOT EXISTS booking_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assignment_id_1 UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  assignment_id_2 UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  conflict_date DATE NOT NULL,
  override_reason TEXT,
  overridden_by UUID REFERENCES profiles(id),
  overridden_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_user ON booking_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_date ON booking_conflicts(conflict_date);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON booking_conflicts(is_resolved) WHERE is_resolved = FALSE;

COMMENT ON TABLE booking_conflicts IS 'Tracks double-booking conflicts and their resolutions';

-- ============================================
-- 5. Create booking_status_history table
-- ============================================

CREATE TABLE IF NOT EXISTS booking_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  note TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_history_assignment ON booking_status_history(assignment_id);
CREATE INDEX IF NOT EXISTS idx_booking_history_changed_at ON booking_status_history(changed_at);

COMMENT ON TABLE booking_status_history IS 'Audit trail for booking status changes';

-- ============================================
-- 6. Create calendar_subscriptions table
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('master', 'personal', 'project')),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendar_subs_user ON calendar_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_subs_token ON calendar_subscriptions(token);
CREATE INDEX IF NOT EXISTS idx_calendar_subs_project ON calendar_subscriptions(project_id) WHERE project_id IS NOT NULL;

COMMENT ON TABLE calendar_subscriptions IS 'iCal feed subscription tokens for external calendar apps';

-- ============================================
-- 7. Create updated_at trigger for project_assignments
-- ============================================

CREATE OR REPLACE FUNCTION update_project_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_assignments_updated_at ON project_assignments;
CREATE TRIGGER trigger_project_assignments_updated_at
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_project_assignments_updated_at();

-- ============================================
-- 8. Row Level Security Policies
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_excluded_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_subscriptions ENABLE ROW LEVEL SECURITY;

-- project_assignments policies
DROP POLICY IF EXISTS "Anyone can view assignments" ON project_assignments;
CREATE POLICY "Anyone can view assignments" ON project_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert assignments" ON project_assignments;
CREATE POLICY "Admins can insert assignments" ON project_assignments
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can update assignments" ON project_assignments;
CREATE POLICY "Admins can update assignments" ON project_assignments
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can delete assignments" ON project_assignments;
CREATE POLICY "Admins can delete assignments" ON project_assignments
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- assignment_excluded_dates policies
DROP POLICY IF EXISTS "Anyone can view excluded dates" ON assignment_excluded_dates;
CREATE POLICY "Anyone can view excluded dates" ON assignment_excluded_dates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert excluded dates" ON assignment_excluded_dates;
CREATE POLICY "Admins can insert excluded dates" ON assignment_excluded_dates
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can update excluded dates" ON assignment_excluded_dates;
CREATE POLICY "Admins can update excluded dates" ON assignment_excluded_dates
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can delete excluded dates" ON assignment_excluded_dates;
CREATE POLICY "Admins can delete excluded dates" ON assignment_excluded_dates
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- booking_conflicts policies
DROP POLICY IF EXISTS "Anyone can view conflicts" ON booking_conflicts;
CREATE POLICY "Anyone can view conflicts" ON booking_conflicts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage conflicts" ON booking_conflicts;
CREATE POLICY "Admins can manage conflicts" ON booking_conflicts
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- booking_status_history policies
DROP POLICY IF EXISTS "Anyone can view booking history" ON booking_status_history;
CREATE POLICY "Anyone can view booking history" ON booking_status_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert booking history" ON booking_status_history;
CREATE POLICY "Admins can insert booking history" ON booking_status_history
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- calendar_subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON calendar_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON calendar_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON calendar_subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON calendar_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- ============================================
-- 9. Helper functions
-- ============================================

-- Function to check for user conflicts on a date range
CREATE OR REPLACE FUNCTION check_user_conflicts(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_assignment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  conflicting_project_id UUID,
  conflicting_project_name TEXT,
  conflict_date DATE,
  conflicting_assignment_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.client_name,
    d.date_value::DATE,
    pa.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  CROSS JOIN LATERAL generate_series(
    GREATEST(p.start_date, p_start_date),
    LEAST(p.end_date, p_end_date),
    INTERVAL '1 day'
  ) AS d(date_value)
  WHERE pa.user_id = p_user_id
    AND (p_exclude_assignment_id IS NULL OR pa.id != p_exclude_assignment_id)
    AND p.start_date IS NOT NULL
    AND p.end_date IS NOT NULL
    AND d.date_value::DATE NOT IN (
      SELECT aed.excluded_date
      FROM assignment_excluded_dates aed
      WHERE aed.assignment_id = pa.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's effective schedule for a date range
CREATE OR REPLACE FUNCTION get_user_schedule(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  schedule_date DATE,
  project_id UUID,
  project_name TEXT,
  booking_status TEXT,
  assignment_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.date_value::DATE,
    p.id,
    p.client_name,
    pa.booking_status,
    pa.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  CROSS JOIN LATERAL generate_series(
    GREATEST(p.start_date, p_start_date),
    LEAST(p.end_date, p_end_date),
    INTERVAL '1 day'
  ) AS d(date_value)
  WHERE pa.user_id = p_user_id
    AND p.start_date IS NOT NULL
    AND p.end_date IS NOT NULL
    AND d.date_value::DATE NOT IN (
      SELECT aed.excluded_date
      FROM assignment_excluded_dates aed
      WHERE aed.assignment_id = pa.id
    )
  ORDER BY d.date_value, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all assignments for a date range (for calendar view)
CREATE OR REPLACE FUNCTION get_calendar_assignments(
  p_start_date DATE,
  p_end_date DATE,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  project_id UUID,
  project_name TEXT,
  user_id UUID,
  user_name TEXT,
  booking_status TEXT,
  project_start_date DATE,
  project_end_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    p.id,
    p.client_name,
    pa.user_id,
    pr.full_name,
    pa.booking_status,
    p.start_date,
    p.end_date
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN profiles pr ON pr.id = pa.user_id
  WHERE p.start_date IS NOT NULL
    AND p.end_date IS NOT NULL
    AND p.start_date <= p_end_date
    AND p.end_date >= p_start_date
    AND (p_project_id IS NULL OR p.id = p_project_id)
  ORDER BY p.start_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
