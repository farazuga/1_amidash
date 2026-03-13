-- L10 Scorecard
-- Weekly KPI tracking

-- One scorecard per team
CREATE TABLE l10_scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Scorecard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_l10_scorecards_updated_at
  BEFORE UPDATE ON l10_scorecards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Measurables (KPI definitions)
CREATE TABLE l10_scorecard_measurables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scorecard_id UUID NOT NULL REFERENCES l10_scorecards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  unit TEXT NOT NULL CHECK (unit IN ('number', 'currency', 'percentage')) DEFAULT 'number',
  goal_value DECIMAL(12,2),
  goal_direction TEXT CHECK (goal_direction IN ('above', 'below', 'exact')) DEFAULT 'above',
  auto_source TEXT CHECK (auto_source IN ('po_revenue', 'invoiced_revenue')),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_l10_scorecard_measurables_updated_at
  BEFORE UPDATE ON l10_scorecard_measurables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Entries (weekly values)
CREATE TABLE l10_scorecard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  measurable_id UUID NOT NULL REFERENCES l10_scorecard_measurables(id) ON DELETE CASCADE,
  week_of DATE NOT NULL, -- Monday of the week
  value DECIMAL(12,2),
  entered_by UUID REFERENCES profiles(id),
  is_auto_populated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(measurable_id, week_of)
);

CREATE TRIGGER update_l10_scorecard_entries_updated_at
  BEFORE UPDATE ON l10_scorecard_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE l10_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_scorecard_measurables ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_scorecard_entries ENABLE ROW LEVEL SECURITY;

-- Scorecards policies (via team membership)
CREATE POLICY "Team members can view scorecards" ON l10_scorecards
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage scorecards" ON l10_scorecards
  FOR ALL TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Measurables policies (via scorecard -> team)
CREATE POLICY "Team members can view measurables" ON l10_scorecard_measurables
  FOR SELECT TO authenticated
  USING (
    scorecard_id IN (
      SELECT id FROM l10_scorecards WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage measurables" ON l10_scorecard_measurables
  FOR ALL TO authenticated
  USING (
    scorecard_id IN (
      SELECT id FROM l10_scorecards WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Entries policies (via measurable -> scorecard -> team)
CREATE POLICY "Team members can view entries" ON l10_scorecard_entries
  FOR SELECT TO authenticated
  USING (
    measurable_id IN (
      SELECT id FROM l10_scorecard_measurables WHERE scorecard_id IN (
        SELECT id FROM l10_scorecards WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage entries" ON l10_scorecard_entries
  FOR ALL TO authenticated
  USING (
    measurable_id IN (
      SELECT id FROM l10_scorecard_measurables WHERE scorecard_id IN (
        SELECT id FROM l10_scorecards WHERE team_id IN (
          SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );
