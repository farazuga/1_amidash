-- L10 Performance Indexes
-- team_members (critical - used in every L10 RLS policy)
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- l10_rocks
CREATE INDEX IF NOT EXISTS idx_l10_rocks_team_id ON l10_rocks(team_id);
CREATE INDEX IF NOT EXISTS idx_l10_rocks_team_quarter ON l10_rocks(team_id, quarter);

-- l10_issues
CREATE INDEX IF NOT EXISTS idx_l10_issues_team_id ON l10_issues(team_id);
CREATE INDEX IF NOT EXISTS idx_l10_issues_team_status ON l10_issues(team_id, status);

-- l10_todos
CREATE INDEX IF NOT EXISTS idx_l10_todos_team_id ON l10_todos(team_id);
CREATE INDEX IF NOT EXISTS idx_l10_todos_owner_done ON l10_todos(owner_id, is_done);
CREATE INDEX IF NOT EXISTS idx_l10_todos_source_issue ON l10_todos(source_issue_id);

-- l10_headlines
CREATE INDEX IF NOT EXISTS idx_l10_headlines_team_id ON l10_headlines(team_id);

-- l10_scorecard_measurables
CREATE INDEX IF NOT EXISTS idx_l10_measurables_scorecard ON l10_scorecard_measurables(scorecard_id);

-- l10_meetings
CREATE INDEX IF NOT EXISTS idx_l10_meetings_team_id ON l10_meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_l10_meetings_team_status ON l10_meetings(team_id, status);

-- l10_meeting_attendees
CREATE INDEX IF NOT EXISTS idx_l10_meeting_attendees_meeting ON l10_meeting_attendees(meeting_id);

-- l10_meeting_ratings
CREATE INDEX IF NOT EXISTS idx_l10_meeting_ratings_meeting ON l10_meeting_ratings(meeting_id);
