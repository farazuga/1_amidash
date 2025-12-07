-- Add is_exception column to statuses table
-- Exception statuses are possible in a project type but not shown in the standard workflow timeline
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_exception BOOLEAN DEFAULT FALSE;

-- Add invoiced_revenue_goal to revenue_goals table for tracking dollar amounts of invoiced projects
ALTER TABLE revenue_goals ADD COLUMN IF NOT EXISTS invoiced_revenue_goal NUMERIC(12, 2) DEFAULT 0;
