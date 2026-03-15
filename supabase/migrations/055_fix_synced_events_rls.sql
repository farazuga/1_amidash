-- Migration: Fix RLS on synced_calendar_events
-- The service_role-only policy was blocking upserts from createServiceClient
-- since @supabase/ssr createServerClient passes user auth context.
-- Allow users to manage their own synced events.

DROP POLICY IF EXISTS "Service role manages synced events" ON synced_calendar_events;
DROP POLICY IF EXISTS "Users can view own synced events" ON synced_calendar_events;

-- Combined policy: users can manage their own rows, service_role can manage all
CREATE POLICY "Manage synced events"
  ON synced_calendar_events FOR ALL
  USING (user_id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');
