-- Migration: Update RPC functions to use assignment_days instead of excluded_dates
-- This unifies the data model around the newer assignment_days table

-- 1. Update check_user_conflicts to use assignment_days
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
    ad.work_date,
    pa.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN assignment_days ad ON ad.assignment_id = pa.id
  WHERE pa.user_id = p_user_id
    AND (p_exclude_assignment_id IS NULL OR pa.id != p_exclude_assignment_id)
    AND ad.work_date >= p_start_date
    AND ad.work_date <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update get_user_schedule to use assignment_days
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
    ad.work_date,
    p.id,
    p.client_name,
    pa.booking_status,
    pa.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN assignment_days ad ON ad.assignment_id = pa.id
  WHERE pa.user_id = p_user_id
    AND ad.work_date >= p_start_date
    AND ad.work_date <= p_end_date
  ORDER BY ad.work_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update get_calendar_assignments to include assignment_days info
-- This returns base assignment data; days are fetched separately for efficiency
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
  SELECT DISTINCT
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
  WHERE EXISTS (
    -- Only include assignments that have days in the requested range
    SELECT 1 FROM assignment_days ad
    WHERE ad.assignment_id = pa.id
      AND ad.work_date >= p_start_date
      AND ad.work_date <= p_end_date
  )
  AND (p_project_id IS NULL OR p.id = p_project_id)
  ORDER BY p.start_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add a helper function to get assignment days for a range
CREATE OR REPLACE FUNCTION get_assignment_days_in_range(
  p_assignment_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  day_id UUID,
  work_date DATE,
  start_time TIME,
  end_time TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.work_date,
    ad.start_time,
    ad.end_time
  FROM assignment_days ad
  WHERE ad.assignment_id = p_assignment_id
    AND ad.work_date >= p_start_date
    AND ad.work_date <= p_end_date
  ORDER BY ad.work_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add comment indicating deprecated table
COMMENT ON TABLE assignment_excluded_dates IS
  'DEPRECATED: Use assignment_days instead. This table is kept for backward compatibility but is no longer used by RPC functions.';
