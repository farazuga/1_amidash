-- Migration: Add sales_order_number to get_user_schedule RPC
-- This allows the My Schedule page to link directly to project calendar pages

CREATE OR REPLACE FUNCTION get_user_schedule(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  schedule_date DATE,
  project_id UUID,
  project_name TEXT,
  sales_order_number TEXT,
  booking_status TEXT,
  assignment_id UUID,
  start_time TIME,
  end_time TIME,
  day_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.work_date,
    p.id,
    p.client_name,
    p.sales_order_number,
    pa.booking_status,
    pa.id,
    ad.start_time,
    ad.end_time,
    ad.id
  FROM project_assignments pa
  JOIN projects p ON p.id = pa.project_id
  JOIN assignment_days ad ON ad.assignment_id = pa.id
  WHERE pa.user_id = p_user_id
    AND ad.work_date >= p_start_date
    AND ad.work_date <= p_end_date
  ORDER BY ad.work_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
