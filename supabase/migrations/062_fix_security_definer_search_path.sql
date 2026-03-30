-- Migration: Add SET search_path to all SECURITY DEFINER functions
-- Prevents search_path injection attacks where a malicious schema could
-- shadow public tables/functions used inside SECURITY DEFINER context.
--
-- Functions already fixed (skipped):
--   increment_portal_views (061) - SET search_path = public
--   is_team_member (042)         - SET search_path = ''
--   has_team_role (042)           - SET search_path = ''
--   get_user_team_ids (042)       - SET search_path = ''
--   is_team_creator (042)         - SET search_path = ''
--   get_comment_team_id (046)     - SET search_path = ''

-- ============================================
-- 1. get_user_role (001) — CRITICAL: used in nearly all RLS policies
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;

-- ============================================
-- 2. handle_new_user (001) — trigger on auth.users
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 3. get_emails_enabled (007)
-- ============================================
CREATE OR REPLACE FUNCTION get_emails_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT (value)::boolean FROM app_settings WHERE key = 'emails_enabled'),
        true
    );
END;
$$;

-- ============================================
-- 4. get_monthly_goal (006)
-- ============================================
CREATE OR REPLACE FUNCTION get_monthly_goal(p_year INT, p_month INT)
RETURNS TABLE(revenue_goal DECIMAL, projects_goal INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT rg.revenue_goal, rg.projects_goal
  FROM revenue_goals rg
  WHERE rg.year = p_year AND rg.month = p_month;
END;
$$;

-- ============================================
-- 5. get_quarterly_goal (006)
-- ============================================
CREATE OR REPLACE FUNCTION get_quarterly_goal(p_year INT, p_quarter INT)
RETURNS TABLE(revenue_goal DECIMAL, projects_goal INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_month INT;
  end_month INT;
BEGIN
  start_month := (p_quarter - 1) * 3 + 1;
  end_month := start_month + 2;

  RETURN QUERY
  SELECT
    COALESCE(SUM(rg.revenue_goal), 0::DECIMAL) as revenue_goal,
    COALESCE(SUM(rg.projects_goal), 0)::INT as projects_goal
  FROM revenue_goals rg
  WHERE rg.year = p_year
    AND rg.month >= start_month
    AND rg.month <= end_month;
END;
$$;

-- ============================================
-- 6. get_yearly_goal (006)
-- ============================================
CREATE OR REPLACE FUNCTION get_yearly_goal(p_year INT)
RETURNS TABLE(revenue_goal DECIMAL, projects_goal INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(rg.revenue_goal), 0::DECIMAL) as revenue_goal,
    COALESCE(SUM(rg.projects_goal), 0)::INT as projects_goal
  FROM revenue_goals rg
  WHERE rg.year = p_year;
END;
$$;

-- ============================================
-- 7. check_user_availability (016)
-- ============================================
CREATE OR REPLACE FUNCTION check_user_availability(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  is_available BOOLEAN,
  availability_type TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 8. get_user_availability_range (016)
-- ============================================
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 9. check_user_conflicts (016)
-- ============================================
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 10. get_user_schedule (033 — latest version)
-- ============================================
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 11. get_calendar_assignments (027 — latest version)
-- ============================================
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 12. get_assignment_days_in_range (015)
-- ============================================
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- 13. get_sharepoint_config (024)
-- ============================================
CREATE OR REPLACE FUNCTION get_sharepoint_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT value
    FROM app_settings
    WHERE key = 'sharepoint_config'
  );
END;
$$;

-- ============================================
-- 14. is_sharepoint_configured (024)
-- ============================================
CREATE OR REPLACE FUNCTION is_sharepoint_configured()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM app_settings
    WHERE key = 'sharepoint_config'
    AND value IS NOT NULL
    AND value != 'null'::jsonb
  );
END;
$$;

-- ============================================
-- 15. get_project_file_counts (023)
-- ============================================
CREATE OR REPLACE FUNCTION get_project_file_counts(p_project_id UUID)
RETURNS TABLE (
  category file_category,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pf.category, COUNT(*)::BIGINT
  FROM project_files pf
  WHERE pf.project_id = p_project_id
  GROUP BY pf.category
  ORDER BY pf.category;
END;
$$;

-- ============================================
-- 16. get_presales_file_counts (023)
-- ============================================
CREATE OR REPLACE FUNCTION get_presales_file_counts(p_deal_id TEXT)
RETURNS TABLE (
  category file_category,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pf.category, COUNT(*)::BIGINT
  FROM presales_files pf
  WHERE pf.activecampaign_deal_id = p_deal_id
  GROUP BY pf.category
  ORDER BY pf.category;
END;
$$;

-- ============================================
-- 17. link_presales_files_to_project (023)
-- ============================================
CREATE OR REPLACE FUNCTION link_presales_files_to_project(
  p_deal_id TEXT,
  p_project_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  files_linked INTEGER;
BEGIN
  -- Update presales files to link to the project
  UPDATE presales_files
  SET project_id = p_project_id,
      updated_at = NOW()
  WHERE activecampaign_deal_id = p_deal_id
    AND project_id IS NULL;

  GET DIAGNOSTICS files_linked = ROW_COUNT;
  RETURN files_linked;
END;
$$;

-- ============================================
-- 18. migrate_presales_to_project_files (023)
-- ============================================
CREATE OR REPLACE FUNCTION migrate_presales_to_project_files(
  p_deal_id TEXT,
  p_project_id UUID,
  p_connection_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  files_migrated INTEGER := 0;
  presales_record RECORD;
BEGIN
  -- First link the presales files to the project
  PERFORM link_presales_files_to_project(p_deal_id, p_project_id);

  -- Then create corresponding project_files entries
  FOR presales_record IN
    SELECT * FROM presales_files
    WHERE activecampaign_deal_id = p_deal_id
      AND project_id = p_project_id
  LOOP
    INSERT INTO project_files (
      project_id,
      connection_id,
      presales_file_id,
      file_name,
      sharepoint_item_id,
      category,
      file_size,
      mime_type,
      file_extension,
      web_url,
      download_url,
      thumbnail_url,
      uploaded_by,
      project_phase,
      notes,
      upload_status,
      is_synced,
      captured_on_device,
      captured_offline
    ) VALUES (
      p_project_id,
      p_connection_id,
      presales_record.id,
      presales_record.file_name,
      presales_record.sharepoint_item_id,
      presales_record.category,
      presales_record.file_size,
      presales_record.mime_type,
      presales_record.file_extension,
      presales_record.web_url,
      presales_record.download_url,
      presales_record.thumbnail_url,
      presales_record.uploaded_by,
      'quoting',  -- These were created during quoting phase
      presales_record.notes,
      presales_record.upload_status,
      TRUE,  -- Already synced to SharePoint
      presales_record.captured_on_device,
      presales_record.captured_offline
    );

    files_migrated := files_migrated + 1;
  END LOOP;

  RETURN files_migrated;
END;
$$;

-- ============================================
-- 19. get_pending_upload_count (023)
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_upload_count(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM (
      SELECT id FROM project_files
      WHERE uploaded_by = p_user_id
        AND upload_status IN ('pending', 'uploading')
      UNION ALL
      SELECT id FROM presales_files
      WHERE uploaded_by = p_user_id
        AND upload_status IN ('pending', 'uploading')
    ) combined
  );
END;
$$;

-- ============================================
-- 20. validate_confirmation_token (018)
-- ============================================
CREATE OR REPLACE FUNCTION validate_confirmation_token(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  request_id UUID,
  project_id UUID,
  status TEXT,
  is_expired BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Find the request
  SELECT cr.* INTO v_request
  FROM confirmation_requests cr
  WHERE cr.token = p_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE, NULL::UUID, NULL::UUID, NULL::TEXT, FALSE, 'Invalid token'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_request.expires_at < NOW() THEN
    -- Update status to expired if still pending
    IF v_request.status = 'pending' THEN
      UPDATE confirmation_requests
      SET status = 'expired'
      WHERE id = v_request.id;
    END IF;

    RETURN QUERY SELECT
      FALSE, v_request.id, v_request.project_id, 'expired'::TEXT, TRUE, 'Token has expired'::TEXT;
    RETURN;
  END IF;

  -- Check if already responded
  IF v_request.status != 'pending' THEN
    RETURN QUERY SELECT
      FALSE, v_request.id, v_request.project_id, v_request.status, FALSE, 'Already responded'::TEXT;
    RETURN;
  END IF;

  -- Valid token
  RETURN QUERY SELECT
    TRUE, v_request.id, v_request.project_id, v_request.status, FALSE, NULL::TEXT;
END;
$$;

-- ============================================
-- 21. process_confirmation_response (018)
-- ============================================
CREATE OR REPLACE FUNCTION process_confirmation_response(
  p_token TEXT,
  p_action TEXT,  -- 'confirm' or 'decline'
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_is_valid BOOLEAN;
  v_new_status TEXT;
  v_new_booking_status TEXT;
BEGIN
  -- Validate token first
  SELECT vct.is_valid, vct.request_id, vct.error_message
  INTO v_is_valid, v_request_id, error_message
  FROM validate_confirmation_token(p_token) vct;

  IF NOT v_is_valid THEN
    RETURN QUERY SELECT FALSE, error_message;
    RETURN;
  END IF;

  -- Determine new statuses
  IF p_action = 'confirm' THEN
    v_new_status := 'confirmed';
    v_new_booking_status := 'confirmed';
  ELSIF p_action = 'decline' THEN
    v_new_status := 'declined';
    v_new_booking_status := 'tentative';  -- Revert to tentative on decline
  ELSE
    RETURN QUERY SELECT FALSE, 'Invalid action. Must be confirm or decline.'::TEXT;
    RETURN;
  END IF;

  -- Update confirmation request
  UPDATE confirmation_requests
  SET
    status = v_new_status,
    responded_at = NOW(),
    decline_reason = CASE WHEN p_action = 'decline' THEN p_decline_reason ELSE NULL END
  WHERE id = v_request_id;

  -- Update all linked assignments
  UPDATE project_assignments pa
  SET booking_status = v_new_booking_status
  FROM confirmation_request_assignments cra
  WHERE cra.confirmation_request_id = v_request_id
    AND cra.assignment_id = pa.id;

  -- Record status history for each assignment
  INSERT INTO booking_status_history (assignment_id, old_status, new_status, note)
  SELECT
    cra.assignment_id,
    'pending_confirm',
    v_new_booking_status,
    CASE
      WHEN p_action = 'confirm' THEN 'Customer confirmed via portal'
      ELSE 'Customer declined via portal: ' || COALESCE(p_decline_reason, 'No reason provided')
    END
  FROM confirmation_request_assignments cra
  WHERE cra.confirmation_request_id = v_request_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

-- ============================================
-- 22. get_confirmation_details (018)
-- ============================================
CREATE OR REPLACE FUNCTION get_confirmation_details(p_token TEXT)
RETURNS TABLE (
  project_name TEXT,
  customer_name TEXT,
  sent_to_email TEXT,
  sent_to_name TEXT,
  status TEXT,
  is_expired BOOLEAN,
  expires_at TIMESTAMPTZ,
  assignment_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.client_name,
    p.poc_name,
    cr.sent_to_email,
    cr.sent_to_name,
    cr.status,
    (cr.expires_at < NOW()),
    cr.expires_at,
    (SELECT COUNT(*)::INTEGER FROM confirmation_request_assignments WHERE confirmation_request_id = cr.id)
  FROM confirmation_requests cr
  JOIN projects p ON p.id = cr.project_id
  WHERE cr.token = p_token;
END;
$$;

-- ============================================
-- 23. get_confirmation_schedule (018)
-- ============================================
CREATE OR REPLACE FUNCTION get_confirmation_schedule(p_token TEXT)
RETURNS TABLE (
  work_date DATE,
  start_time TIME,
  end_time TIME,
  engineer_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.work_date,
    ad.start_time,
    ad.end_time,
    pr.full_name
  FROM confirmation_requests cr
  JOIN confirmation_request_assignments cra ON cra.confirmation_request_id = cr.id
  JOIN project_assignments pa ON pa.id = cra.assignment_id
  JOIN profiles pr ON pr.id = pa.user_id
  JOIN assignment_days ad ON ad.assignment_id = pa.id
  WHERE cr.token = p_token
  ORDER BY ad.work_date, ad.start_time, pr.full_name;
END;
$$;

-- ============================================
-- 24. expire_pending_confirmation_requests (018)
-- ============================================
CREATE OR REPLACE FUNCTION expire_pending_confirmation_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE confirmation_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN expired_count;
END;
$$;
