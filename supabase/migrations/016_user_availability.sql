-- Migration: User Availability / Time-Off
-- Allows users to mark dates as unavailable with reasons

-- Create user_availability table
CREATE TABLE IF NOT EXISTS user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  availability_type TEXT NOT NULL DEFAULT 'unavailable' CHECK (availability_type IN ('unavailable', 'limited', 'training', 'pto', 'sick')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  -- Prevent overlapping availability blocks for the same user
  CONSTRAINT user_availability_date_check CHECK (end_date >= start_date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_availability_dates ON user_availability(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_user_availability_user_dates ON user_availability(user_id, start_date, end_date);

-- Enable RLS
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- Policies: Admins can manage all, users can view their own
CREATE POLICY "Admins can manage user_availability"
  ON user_availability
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own availability"
  ON user_availability
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to check if a user is available on a given date
CREATE OR REPLACE FUNCTION check_user_availability(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  is_available BOOLEAN,
  availability_type TEXT,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN ua.id IS NULL THEN TRUE ELSE FALSE END as is_available,
    COALESCE(ua.availability_type, 'available') as availability_type,
    ua.reason
  FROM (SELECT 1) dummy
  LEFT JOIN user_availability ua ON
    ua.user_id = p_user_id
    AND p_date BETWEEN ua.start_date AND ua.end_date
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user availability for a date range
CREATE OR REPLACE FUNCTION get_user_availability_range(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  start_date DATE,
  end_date DATE,
  reason TEXT,
  availability_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ua.id,
    ua.start_date,
    ua.end_date,
    ua.reason,
    ua.availability_type
  FROM user_availability ua
  WHERE ua.user_id = p_user_id
    AND ua.start_date <= p_end_date
    AND ua.end_date >= p_start_date
  ORDER BY ua.start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update check_user_conflicts to also consider availability
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
  conflicting_assignment_id UUID,
  conflict_type TEXT
) AS $$
BEGIN
  -- Return conflicts from existing assignments
  RETURN QUERY
  SELECT
    p.id as conflicting_project_id,
    p.client_name as conflicting_project_name,
    d.work_date as conflict_date,
    pa.id as conflicting_assignment_id,
    'assignment' as conflict_type
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN assignment_days d ON d.assignment_id = pa.id
  WHERE pa.user_id = p_user_id
    AND (p_exclude_assignment_id IS NULL OR pa.id != p_exclude_assignment_id)
    AND d.work_date BETWEEN p_start_date AND p_end_date

  UNION ALL

  -- Return conflicts from unavailability blocks
  SELECT
    NULL as conflicting_project_id,
    COALESCE(ua.reason, ua.availability_type) as conflicting_project_name,
    gs::date as conflict_date,
    NULL as conflicting_assignment_id,
    'unavailable' as conflict_type
  FROM user_availability ua
  CROSS JOIN generate_series(
    GREATEST(ua.start_date, p_start_date),
    LEAST(ua.end_date, p_end_date),
    '1 day'::interval
  ) gs
  WHERE ua.user_id = p_user_id
    AND ua.start_date <= p_end_date
    AND ua.end_date >= p_start_date

  ORDER BY conflict_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
