-- Fix l10_meeting_ratings RLS: allow any team member to submit ratings for any attendee
-- Previously INSERT required user_id = auth.uid(), blocking facilitators from entering
-- ratings on behalf of other members.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can manage their own ratings" ON l10_meeting_ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON l10_meeting_ratings;

-- Allow any team member to insert ratings for any user in the meeting
CREATE POLICY "Team members can insert ratings" ON l10_meeting_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Allow any team member to update ratings for the meeting
CREATE POLICY "Team members can update ratings" ON l10_meeting_ratings
  FOR UPDATE TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Reset any issues stuck in 'solving' back to 'open'
UPDATE l10_issues SET status = 'open' WHERE status = 'solving';
