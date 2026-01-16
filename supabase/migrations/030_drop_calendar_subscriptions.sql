-- Migration: Drop calendar_subscriptions table
-- iCal subscription feature has been removed

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view own subscriptions" ON calendar_subscriptions;
DROP POLICY IF EXISTS "Users can create own subscriptions" ON calendar_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON calendar_subscriptions;
DROP POLICY IF EXISTS "Service role can read subscriptions" ON calendar_subscriptions;

-- Drop the table
DROP TABLE IF EXISTS calendar_subscriptions;
