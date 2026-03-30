-- Fix: Anon RLS policy on projects table leaks all rows
-- The old policy checked `client_token IS NOT NULL` which is always true.
-- Portal access goes through service client, so no anon SELECT policy needed.

DROP POLICY IF EXISTS "Public can view project by token" ON projects;
