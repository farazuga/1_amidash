-- Migration: Calendar Enhancements
-- Adds per-day time tracking, assignable users flag, and Gantt view support

-- 1. Add is_assignable flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_assignable BOOLEAN DEFAULT false;

-- Set existing admins as assignable by default
UPDATE profiles SET is_assignable = true WHERE role = 'admin' AND is_assignable IS NOT TRUE;

-- 2. Create assignment_days table for per-day time tracking
CREATE TABLE IF NOT EXISTS assignment_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, work_date),
  CONSTRAINT chk_time_order CHECK (end_time > start_time)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignment_days_assignment ON assignment_days(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_days_date ON assignment_days(work_date);

-- 3. Migrate existing assignments to assignment_days
-- For each existing assignment, create assignment_days for each day in project range
-- excluding dates that are in assignment_excluded_dates
INSERT INTO assignment_days (assignment_id, work_date, start_time, end_time, created_by)
SELECT
  pa.id,
  d::date,
  '08:00:00'::time,
  '17:00:00'::time,
  pa.created_by
FROM project_assignments pa
JOIN projects p ON pa.project_id = p.id
CROSS JOIN generate_series(p.start_date, p.end_date, '1 day'::interval) d
WHERE p.start_date IS NOT NULL
  AND p.end_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM assignment_excluded_dates aed
    WHERE aed.assignment_id = pa.id AND aed.excluded_date = d::date
  )
  AND NOT EXISTS (
    -- Don't insert if already exists
    SELECT 1 FROM assignment_days ad
    WHERE ad.assignment_id = pa.id AND ad.work_date = d::date
  );

-- 4. Enable RLS on assignment_days
ALTER TABLE assignment_days ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can view assignment days" ON assignment_days;
DROP POLICY IF EXISTS "Admins can manage assignment days" ON assignment_days;

-- Create RLS policies
CREATE POLICY "Anyone can view assignment days" ON assignment_days
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage assignment days" ON assignment_days
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_assignment_days_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS assignment_days_updated_at ON assignment_days;
CREATE TRIGGER assignment_days_updated_at
  BEFORE UPDATE ON assignment_days
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_days_updated_at();

-- 6. Add is_salesperson column if it doesn't exist (for older schemas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'profiles' AND column_name = 'is_salesperson') THEN
    ALTER TABLE profiles ADD COLUMN is_salesperson BOOLEAN DEFAULT false;
  END IF;
END $$;
