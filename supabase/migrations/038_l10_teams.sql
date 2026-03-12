-- L10 Teams
-- Teams and team membership for L10 meetings

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Team members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'facilitator', 'admin')) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Team members can view their teams" ON teams
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team admins and facilitators can update their teams" ON teams
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin', 'facilitator'))
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins can delete their teams" ON teams
  FOR DELETE TO authenticated
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Team members policies
CREATE POLICY "Team members can view their team members" ON team_members
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members AS tm WHERE tm.user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins and facilitators can manage members" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (SELECT team_id FROM team_members AS tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'facilitator'))
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins and facilitators can update members" ON team_members
  FOR UPDATE TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members AS tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'facilitator'))
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team admins and facilitators can remove members" ON team_members
  FOR DELETE TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members AS tm WHERE tm.user_id = auth.uid() AND tm.role IN ('admin', 'facilitator'))
    OR get_user_role(auth.uid()) = 'admin'
    OR user_id = auth.uid()
  );
