-- Customer Confirmation Requests Migration
-- Migration: 018_confirmation_requests.sql
-- Purpose:
--   1. Create confirmation_requests table for customer confirmation workflow
--   2. Create confirmation_request_assignments junction table
--   3. Add RLS policies for security
--   4. Add helper functions for token validation and expiration

-- ============================================
-- 1. Create confirmation_requests table
-- ============================================

CREATE TABLE IF NOT EXISTS confirmation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Project reference
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Magic link token (unique, secure)
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Recipient information
  sent_to_email TEXT NOT NULL,
  sent_to_name TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Response tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'declined', 'expired')) DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE confirmation_requests IS 'Customer confirmation requests for project schedule approval';
COMMENT ON COLUMN confirmation_requests.token IS 'Unique magic link token for customer access (32 bytes, hex encoded)';
COMMENT ON COLUMN confirmation_requests.status IS 'pending=awaiting response, confirmed=customer approved, declined=customer rejected, expired=link timed out';
COMMENT ON COLUMN confirmation_requests.expires_at IS 'Token expiration (default 7 days from creation)';
COMMENT ON COLUMN confirmation_requests.decline_reason IS 'Optional reason provided by customer when declining';

-- ============================================
-- 2. Create confirmation_request_assignments junction table
-- ============================================

CREATE TABLE IF NOT EXISTS confirmation_request_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_request_id UUID NOT NULL REFERENCES confirmation_requests(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate links
  UNIQUE(confirmation_request_id, assignment_id)
);

COMMENT ON TABLE confirmation_request_assignments IS 'Links confirmation requests to their associated assignments';

-- ============================================
-- 3. Create indexes for performance
-- ============================================

-- Fast token lookup (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_confirmation_requests_token
  ON confirmation_requests(token);

-- Project queries
CREATE INDEX IF NOT EXISTS idx_confirmation_requests_project
  ON confirmation_requests(project_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_confirmation_requests_status
  ON confirmation_requests(status);

-- Expiration checks
CREATE INDEX IF NOT EXISTS idx_confirmation_requests_expires
  ON confirmation_requests(expires_at)
  WHERE status = 'pending';

-- Pending requests by created_by (PM dashboard)
CREATE INDEX IF NOT EXISTS idx_confirmation_requests_created_by
  ON confirmation_requests(created_by)
  WHERE status = 'pending';

-- Junction table indexes
CREATE INDEX IF NOT EXISTS idx_confirmation_request_assignments_request
  ON confirmation_request_assignments(confirmation_request_id);

CREATE INDEX IF NOT EXISTS idx_confirmation_request_assignments_assignment
  ON confirmation_request_assignments(assignment_id);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================

ALTER TABLE confirmation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_request_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS Policies for confirmation_requests
-- ============================================

-- View: All authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view confirmation requests" ON confirmation_requests;
CREATE POLICY "Authenticated users can view confirmation requests"
  ON confirmation_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Admin/Editor only
DROP POLICY IF EXISTS "Admin/Editor can create confirmation requests" ON confirmation_requests;
CREATE POLICY "Admin/Editor can create confirmation requests"
  ON confirmation_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

-- Update: Admin/Editor can update (for manual status changes)
DROP POLICY IF EXISTS "Admin/Editor can update confirmation requests" ON confirmation_requests;
CREATE POLICY "Admin/Editor can update confirmation requests"
  ON confirmation_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

-- Delete: Admin only
DROP POLICY IF EXISTS "Admin can delete confirmation requests" ON confirmation_requests;
CREATE POLICY "Admin can delete confirmation requests"
  ON confirmation_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- 6. RLS Policies for confirmation_request_assignments
-- ============================================

-- View: All authenticated users can view
DROP POLICY IF EXISTS "Authenticated users can view confirmation request assignments" ON confirmation_request_assignments;
CREATE POLICY "Authenticated users can view confirmation request assignments"
  ON confirmation_request_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Admin/Editor only
DROP POLICY IF EXISTS "Admin/Editor can create confirmation request assignments" ON confirmation_request_assignments;
CREATE POLICY "Admin/Editor can create confirmation request assignments"
  ON confirmation_request_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

-- Delete: Admin/Editor only
DROP POLICY IF EXISTS "Admin/Editor can delete confirmation request assignments" ON confirmation_request_assignments;
CREATE POLICY "Admin/Editor can delete confirmation request assignments"
  ON confirmation_request_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

-- ============================================
-- 7. Helper Functions
-- ============================================

-- Function to validate a confirmation token
CREATE OR REPLACE FUNCTION validate_confirmation_token(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  request_id UUID,
  project_id UUID,
  status TEXT,
  is_expired BOOLEAN,
  error_message TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_confirmation_token IS
  'Validates a confirmation token and returns its status. Auto-expires pending tokens past their expiration date.';

-- Function to process a confirmation response
CREATE OR REPLACE FUNCTION process_confirmation_response(
  p_token TEXT,
  p_action TEXT,  -- 'confirm' or 'decline'
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_confirmation_response IS
  'Processes a customer confirmation or decline. Updates request status and all linked assignments.';

-- Function to get confirmation request details for display
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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_confirmation_details IS
  'Returns confirmation request details for the customer-facing confirmation page.';

-- Function to get scheduled dates for a confirmation request
CREATE OR REPLACE FUNCTION get_confirmation_schedule(p_token TEXT)
RETURNS TABLE (
  work_date DATE,
  start_time TIME,
  end_time TIME,
  engineer_name TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_confirmation_schedule IS
  'Returns the scheduled dates and engineers for a confirmation request.';

-- Function to expire old pending requests (can be called by cron)
CREATE OR REPLACE FUNCTION expire_pending_confirmation_requests()
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expire_pending_confirmation_requests IS
  'Expires all pending confirmation requests past their expiration date. Returns count of expired requests.';

-- ============================================
-- 8. Create view for PM dashboard
-- ============================================

CREATE OR REPLACE VIEW pending_confirmations AS
SELECT
  cr.id,
  cr.project_id,
  p.client_name AS project_name,
  cr.sent_to_email,
  cr.sent_to_name,
  cr.sent_at,
  cr.expires_at,
  cr.created_by,
  (cr.expires_at < NOW()) AS is_expired,
  (SELECT COUNT(*) FROM confirmation_request_assignments WHERE confirmation_request_id = cr.id) AS assignment_count
FROM confirmation_requests cr
JOIN projects p ON p.id = cr.project_id
WHERE cr.status = 'pending'
ORDER BY cr.expires_at ASC;

COMMENT ON VIEW pending_confirmations IS
  'View of pending confirmation requests for PM dashboard. Shows oldest (closest to expiry) first.';

-- ============================================
-- Migration verification
-- ============================================

DO $$
DECLARE
  table_exists BOOLEAN;
  function_exists BOOLEAN;
BEGIN
  -- Check tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'confirmation_requests'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE EXCEPTION 'Migration failed: confirmation_requests table not created';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'confirmation_request_assignments'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE EXCEPTION 'Migration failed: confirmation_request_assignments table not created';
  END IF;

  -- Check functions exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'validate_confirmation_token'
  ) INTO function_exists;

  IF NOT function_exists THEN
    RAISE EXCEPTION 'Migration failed: validate_confirmation_token function not created';
  END IF;

  RAISE NOTICE 'Migration 018 completed successfully. Confirmation request tables and functions created.';
END $$;
