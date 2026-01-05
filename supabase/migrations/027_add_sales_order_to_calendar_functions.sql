-- Migration: Add sales_order_number to calendar RPC functions
-- This enables project links to use sales order numbers instead of UUIDs

-- Update get_calendar_assignments to include sales_order_number
CREATE OR REPLACE FUNCTION get_calendar_assignments(
  p_start_date DATE,
  p_end_date DATE,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
  assignment_id UUID,
  project_id UUID,
  project_name TEXT,
  sales_order_number TEXT,
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
    p.sales_order_number,
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
    AND (
      (p.start_date <= p_end_date AND p.end_date >= p_start_date)
      OR p_start_date IS NULL
    )
    AND (p_project_id IS NULL OR p.id = p_project_id)
  ORDER BY p.start_date, p.client_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_schedule to include sales_order_number
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
  assignment_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.work_date,
    p.id,
    p.client_name,
    p.sales_order_number,
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
