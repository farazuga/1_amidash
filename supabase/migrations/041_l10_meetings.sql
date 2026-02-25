-- L10 Meetings
-- Meeting runner, attendees, ratings, and deferred FKs

-- Meeting segment enum values (referenced as text)
-- segue, scorecard, rock_review, headlines, todo_review, ids, conclude

-- Meetings table
CREATE TABLE l10_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'L10 Meeting',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  current_segment TEXT CHECK (current_segment IN ('segue', 'scorecard', 'rock_review', 'headlines', 'todo_review', 'ids', 'conclude')),
  segment_started_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
  facilitator_id UUID REFERENCES profiles(id),
  notes TEXT,
  average_rating DECIMAL(3,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_l10_meetings_updated_at
  BEFORE UPDATE ON l10_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Meeting attendees
CREATE TABLE l10_meeting_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES l10_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

-- Meeting ratings
CREATE TABLE l10_meeting_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES l10_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 10),
  explanation TEXT, -- required if rating < 8 (enforced in app)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, user_id)
);

-- Add deferred foreign keys
ALTER TABLE l10_todos ADD CONSTRAINT l10_todos_source_meeting_fk
  FOREIGN KEY (source_meeting_id) REFERENCES l10_meetings(id) ON DELETE SET NULL;

ALTER TABLE l10_headlines ADD CONSTRAINT l10_headlines_meeting_fk
  FOREIGN KEY (meeting_id) REFERENCES l10_meetings(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE l10_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE l10_meeting_ratings ENABLE ROW LEVEL SECURITY;

-- Meetings policies
CREATE POLICY "Team members can view meetings" ON l10_meetings
  FOR SELECT TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage meetings" ON l10_meetings
  FOR ALL TO authenticated
  USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Attendees policies
CREATE POLICY "Meeting attendees can view attendees" ON l10_meeting_attendees
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Team members can manage attendees" ON l10_meeting_attendees
  FOR ALL TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Ratings policies
CREATE POLICY "Meeting attendees can view ratings" ON l10_meeting_ratings
  FOR SELECT TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM l10_meetings WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Users can manage their own ratings" ON l10_meeting_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND meeting_id IN (
      SELECT id FROM l10_meetings WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own ratings" ON l10_meeting_ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE l10_meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE l10_meeting_attendees;
ALTER PUBLICATION supabase_realtime ADD TABLE l10_meeting_ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE l10_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE l10_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE l10_headlines;
