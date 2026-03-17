-- Core table performance indexes
-- assignment_days compound (used in move-day duplicate checks)
CREATE INDEX IF NOT EXISTS idx_assignment_days_compound ON assignment_days(assignment_id, work_date);

-- projects partial index for dashboard (filters is_draft = false)
CREATE INDEX IF NOT EXISTS idx_projects_not_draft ON projects(current_status_id) WHERE is_draft = false;
