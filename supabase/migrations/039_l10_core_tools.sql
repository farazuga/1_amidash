-- L10 Core Tools
-- Rocks, Issues, To-Dos, Headlines

-- Rocks (quarterly goals)
CREATE TABLE l10_rocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  quarter TEXT NOT NULL, -- e.g. '2026-Q1'
  status TEXT NOT NULL CHECK (status IN ('on_track', 'off_track', 'complete', 'dropped')) DEFAULT 'on_track',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_l10_rocks_updated_at
  BEFORE UPDATE ON l10_rocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Issues (IDS process)
CREATE TABLE l10_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  priority_rank INT NOT NULL DEFAULT 0, -- 0 = unranked
  status TEXT NOT NULL CHECK (status IN ('open', 'solving', 'solved', 'combined')) DEFAULT 'open',
  source_type TEXT, -- 'rock', 'headline', 'scorecard', etc.
  source_id UUID, -- reference to the source entity
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_l10_issues_updated_at
  BEFORE UPDATE ON l10_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- To-Dos (7-day action items)
CREATE TABLE l10_todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days')::DATE,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  source_meeting_id UUID, -- FK added later in 041
  source_issue_id UUID REFERENCES l10_issues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_l10_todos_updated_at
  BEFORE UPDATE ON l10_todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Headlines (meeting announcements)
CREATE TABLE l10_headlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT CHECK (category IN ('customer', 'employee')),
  sentiment TEXT CHECK (sentiment IN ('good', 'bad', 'neutral')) DEFAULT 'neutral',
  created_by UUID REFERENCES profiles(id),
  meeting_id UUID, -- FK added later in 041
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE l10_rocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_headlines ENABLE ROW LEVEL SECURITY;

-- Rocks policies
CREATE POLICY "Team members can view rocks" ON l10_rocks
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage rocks" ON l10_rocks
  FOR ALL TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Issues policies
CREATE POLICY "Team members can view issues" ON l10_issues
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage issues" ON l10_issues
  FOR ALL TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Todos policies
CREATE POLICY "Team members can view todos" ON l10_todos
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage todos" ON l10_todos
  FOR ALL TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Headlines policies
CREATE POLICY "Team members can view headlines" ON l10_headlines
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage headlines" ON l10_headlines
  FOR ALL TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );
