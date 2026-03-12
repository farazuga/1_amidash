-- Rocks Enhancement: Milestones, Fields, Archiving
-- Adds description, due_date, is_archived to rocks
-- Creates milestones table with RLS
-- Links milestones to todos

-- ============================================
-- Add fields to l10_rocks
-- ============================================

ALTER TABLE l10_rocks ADD COLUMN description TEXT;
ALTER TABLE l10_rocks ADD COLUMN due_date DATE;
ALTER TABLE l10_rocks ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- Milestones table
-- ============================================

CREATE TABLE l10_rock_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rock_id UUID NOT NULL REFERENCES l10_rocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  owner_id UUID REFERENCES profiles(id),
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
CREATE TRIGGER update_l10_rock_milestones_updated_at
  BEFORE UPDATE ON l10_rock_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_l10_rock_milestones_rock_id ON l10_rock_milestones(rock_id);
CREATE INDEX idx_l10_rock_milestones_due_incomplete
  ON l10_rock_milestones(due_date)
  WHERE is_complete = FALSE;

-- RLS
ALTER TABLE l10_rock_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view milestones" ON l10_rock_milestones
  FOR SELECT TO authenticated
  USING (
    rock_id IN (
      SELECT id FROM l10_rocks WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage milestones" ON l10_rock_milestones
  FOR ALL TO authenticated
  USING (
    rock_id IN (
      SELECT id FROM l10_rocks WHERE is_team_member(team_id, auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- Link milestones to todos
-- ============================================

ALTER TABLE l10_todos ADD COLUMN source_milestone_id UUID
  REFERENCES l10_rock_milestones(id) ON DELETE SET NULL;

CREATE INDEX idx_l10_todos_source_milestone
  ON l10_todos(source_milestone_id)
  WHERE source_milestone_id IS NOT NULL;

-- ============================================
-- Enable realtime
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE l10_rock_milestones;
