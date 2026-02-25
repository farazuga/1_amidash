-- Fix infinite recursion in L10 RLS policies
-- Problem: policies on team_members reference team_members via subqueries, causing infinite recursion.
-- Fix: SECURITY DEFINER helper functions that bypass RLS for membership checks.

-- ============================================
-- Helper functions (SECURITY DEFINER = bypasses RLS)
-- ============================================

CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION has_team_role(p_team_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND role = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION get_user_team_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION is_team_creator(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND created_by = p_user_id
  );
$$;

-- ============================================
-- Fix teams policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view their teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;
DROP POLICY IF EXISTS "Team admins and facilitators can update their teams" ON teams;
DROP POLICY IF EXISTS "Team admins can delete their teams" ON teams;

CREATE POLICY "Team members can view their teams" ON teams
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT get_user_team_ids(auth.uid()))
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team admins and facilitators can update their teams" ON teams
  FOR UPDATE TO authenticated
  USING (
    has_team_role(id, auth.uid(), ARRAY['admin', 'facilitator'])
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins can delete their teams" ON teams
  FOR DELETE TO authenticated
  USING (
    has_team_role(id, auth.uid(), ARRAY['admin'])
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix team_members policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view their team members" ON team_members;
DROP POLICY IF EXISTS "Team admins and facilitators can manage members" ON team_members;
DROP POLICY IF EXISTS "Team admins and facilitators can update members" ON team_members;
DROP POLICY IF EXISTS "Team admins and facilitators can remove members" ON team_members;

CREATE POLICY "Team members can view their team members" ON team_members
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins and facilitators can manage members" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    has_team_role(team_id, auth.uid(), ARRAY['admin', 'facilitator'])
    OR is_team_creator(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins and facilitators can update members" ON team_members
  FOR UPDATE TO authenticated
  USING (
    has_team_role(team_id, auth.uid(), ARRAY['admin', 'facilitator'])
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins and facilitators can remove members" ON team_members
  FOR DELETE TO authenticated
  USING (
    has_team_role(team_id, auth.uid(), ARRAY['admin', 'facilitator'])
    OR get_user_role(auth.uid()) = 'admin'
    OR user_id = auth.uid()
  );

-- ============================================
-- Fix l10_rocks policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view rocks" ON l10_rocks;
DROP POLICY IF EXISTS "Team members can manage rocks" ON l10_rocks;

CREATE POLICY "Team members can view rocks" ON l10_rocks
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage rocks" ON l10_rocks
  FOR ALL TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_issues policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view issues" ON l10_issues;
DROP POLICY IF EXISTS "Team members can manage issues" ON l10_issues;

CREATE POLICY "Team members can view issues" ON l10_issues
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage issues" ON l10_issues
  FOR ALL TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_todos policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view todos" ON l10_todos;
DROP POLICY IF EXISTS "Team members can manage todos" ON l10_todos;

CREATE POLICY "Team members can view todos" ON l10_todos
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage todos" ON l10_todos
  FOR ALL TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_headlines policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view headlines" ON l10_headlines;
DROP POLICY IF EXISTS "Team members can manage headlines" ON l10_headlines;

CREATE POLICY "Team members can view headlines" ON l10_headlines
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage headlines" ON l10_headlines
  FOR ALL TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_scorecards policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view scorecards" ON l10_scorecards;
DROP POLICY IF EXISTS "Team members can manage scorecards" ON l10_scorecards;

CREATE POLICY "Team members can view scorecards" ON l10_scorecards
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage scorecards" ON l10_scorecards
  FOR ALL TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_scorecard_measurables policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view measurables" ON l10_scorecard_measurables;
DROP POLICY IF EXISTS "Team members can manage measurables" ON l10_scorecard_measurables;

CREATE POLICY "Team members can view measurables" ON l10_scorecard_measurables
  FOR SELECT TO authenticated
  USING (
    scorecard_id IN (
      SELECT id FROM l10_scorecards WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage measurables" ON l10_scorecard_measurables
  FOR ALL TO authenticated
  USING (
    scorecard_id IN (
      SELECT id FROM l10_scorecards WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_scorecard_entries policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view entries" ON l10_scorecard_entries;
DROP POLICY IF EXISTS "Team members can manage entries" ON l10_scorecard_entries;

CREATE POLICY "Team members can view entries" ON l10_scorecard_entries
  FOR SELECT TO authenticated
  USING (
    measurable_id IN (
      SELECT id FROM l10_scorecard_measurables WHERE scorecard_id IN (
        SELECT id FROM l10_scorecards WHERE is_team_member(team_id, auth.uid())
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage entries" ON l10_scorecard_entries
  FOR ALL TO authenticated
  USING (
    measurable_id IN (
      SELECT id FROM l10_scorecard_measurables WHERE scorecard_id IN (
        SELECT id FROM l10_scorecards WHERE is_team_member(team_id, auth.uid())
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_meetings policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view meetings" ON l10_meetings;
DROP POLICY IF EXISTS "Team members can manage meetings" ON l10_meetings;

CREATE POLICY "Team members can view meetings" ON l10_meetings
  FOR SELECT TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage meetings" ON l10_meetings
  FOR ALL TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_meeting_attendees policies
-- ============================================

DROP POLICY IF EXISTS "Meeting attendees can view attendees" ON l10_meeting_attendees;
DROP POLICY IF EXISTS "Team members can manage attendees" ON l10_meeting_attendees;

CREATE POLICY "Meeting attendees can view attendees" ON l10_meeting_attendees
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage attendees" ON l10_meeting_attendees
  FOR ALL TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Fix l10_meeting_ratings policies
-- ============================================

DROP POLICY IF EXISTS "Meeting attendees can view ratings" ON l10_meeting_ratings;
DROP POLICY IF EXISTS "Users can manage their own ratings" ON l10_meeting_ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON l10_meeting_ratings;

CREATE POLICY "Meeting attendees can view ratings" ON l10_meeting_ratings
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Users can manage their own ratings" ON l10_meeting_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND meeting_id IN (
      SELECT id FROM l10_meetings WHERE is_team_member(team_id, auth.uid())
    )
  );

CREATE POLICY "Users can update their own ratings" ON l10_meeting_ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
