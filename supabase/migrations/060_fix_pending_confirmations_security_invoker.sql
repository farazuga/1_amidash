-- Fix: pending_confirmations view uses SECURITY DEFINER (Postgres default for views).
-- This means RLS policies are bypassed since the view runs as the creator's role.
-- Recreate with security_invoker = true so RLS applies to the querying user.

DROP VIEW IF EXISTS pending_confirmations;

CREATE VIEW pending_confirmations
WITH (security_invoker = true)
AS
SELECT
  cr.id,
  cr.project_id,
  p.client_name AS project_name,
  cr.sent_to_email,
  cr.sent_to_name,
  cr.sent_at,
  cr.expires_at,
  cr.created_by,
  cr.expires_at < now() AS is_expired,
  (SELECT count(*) FROM confirmation_request_assignments WHERE confirmation_request_id = cr.id) AS assignment_count
FROM confirmation_requests cr
JOIN projects p ON p.id = cr.project_id
WHERE cr.status = 'pending'
ORDER BY cr.expires_at;

COMMENT ON VIEW pending_confirmations IS
  'View of pending confirmation requests for PM dashboard. Shows oldest (closest to expiry) first. Uses SECURITY INVOKER so RLS applies to the querying user.';
