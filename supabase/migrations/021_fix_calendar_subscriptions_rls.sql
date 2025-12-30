-- Fix RLS policy for calendar_subscriptions to allow admins to create subscriptions for other users
-- The issue was that INSERT operations need WITH CHECK, not just USING

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON calendar_subscriptions;

-- Create separate policies for different operations
-- SELECT: Users can view their own, admins can view all
DROP POLICY IF EXISTS "Users can view own subscriptions" ON calendar_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON calendar_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- INSERT: Users can create their own, admins can create for anyone
CREATE POLICY "Users can insert own subscriptions" ON calendar_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- UPDATE: Users can update their own, admins can update any
CREATE POLICY "Users can update own subscriptions" ON calendar_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin')
  WITH CHECK (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- DELETE: Users can delete their own, admins can delete any
CREATE POLICY "Users can delete own subscriptions" ON calendar_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');
