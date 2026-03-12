-- Add description columns to todos and milestones, create polymorphic comments table

-- ============================================
-- Add description columns
-- ============================================

ALTER TABLE l10_todos ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE l10_rock_milestones ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- Create l10_comments table (polymorphic)
-- ============================================

CREATE TABLE IF NOT EXISTS l10_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('rock', 'todo', 'milestone', 'issue')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_l10_comments_entity ON l10_comments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_l10_comments_user ON l10_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_l10_comments_created ON l10_comments (created_at DESC);

-- ============================================
-- Helper: resolve team_id from any entity
-- ============================================

CREATE OR REPLACE FUNCTION get_comment_team_id(p_entity_type TEXT, p_entity_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_entity_type
    WHEN 'rock' THEN (SELECT team_id FROM public.l10_rocks WHERE id = p_entity_id)
    WHEN 'todo' THEN (SELECT team_id FROM public.l10_todos WHERE id = p_entity_id)
    WHEN 'milestone' THEN (SELECT r.team_id FROM public.l10_rock_milestones m JOIN public.l10_rocks r ON r.id = m.rock_id WHERE m.id = p_entity_id)
    WHEN 'issue' THEN (SELECT team_id FROM public.l10_issues WHERE id = p_entity_id)
  END;
$$;

-- ============================================
-- RLS for l10_comments
-- ============================================

ALTER TABLE l10_comments ENABLE ROW LEVEL SECURITY;

-- Team members can view comments on their team's entities
CREATE POLICY "Team members can view comments" ON l10_comments
  FOR SELECT TO authenticated
  USING (
    is_team_member(get_comment_team_id(entity_type, entity_id), auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Team members can insert comments on their team's entities
CREATE POLICY "Team members can insert comments" ON l10_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_team_member(get_comment_team_id(entity_type, entity_id), auth.uid())
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON l10_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON l10_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- Enable realtime
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE l10_comments;
