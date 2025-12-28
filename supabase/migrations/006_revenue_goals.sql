-- Revenue Goals Schema
-- Stores monthly goals for revenue and invoiced projects
-- Admin-only management

-- ============================================
-- REVENUE GOALS TABLE
-- ============================================
CREATE TABLE revenue_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  revenue_goal DECIMAL(12,2) NOT NULL DEFAULT 0,
  projects_goal INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_revenue_goals_year ON revenue_goals(year);
CREATE INDEX idx_revenue_goals_year_month ON revenue_goals(year, month);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_revenue_goals_updated_at
  BEFORE UPDATE ON revenue_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE revenue_goals ENABLE ROW LEVEL SECURITY;

-- Anyone can view revenue goals
CREATE POLICY "Anyone can view revenue goals" ON revenue_goals
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage revenue goals
CREATE POLICY "Admins can manage revenue goals" ON revenue_goals
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get goal for a specific month
CREATE OR REPLACE FUNCTION get_monthly_goal(p_year INT, p_month INT)
RETURNS TABLE(revenue_goal DECIMAL, projects_goal INT) AS $$
BEGIN
  RETURN QUERY
  SELECT rg.revenue_goal, rg.projects_goal
  FROM revenue_goals rg
  WHERE rg.year = p_year AND rg.month = p_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get quarterly goal (sum of 3 months)
CREATE OR REPLACE FUNCTION get_quarterly_goal(p_year INT, p_quarter INT)
RETURNS TABLE(revenue_goal DECIMAL, projects_goal INT) AS $$
DECLARE
  start_month INT;
  end_month INT;
BEGIN
  start_month := (p_quarter - 1) * 3 + 1;
  end_month := start_month + 2;

  RETURN QUERY
  SELECT
    COALESCE(SUM(rg.revenue_goal), 0::DECIMAL) as revenue_goal,
    COALESCE(SUM(rg.projects_goal), 0)::INT as projects_goal
  FROM revenue_goals rg
  WHERE rg.year = p_year
    AND rg.month >= start_month
    AND rg.month <= end_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get yearly goal (sum of all months)
CREATE OR REPLACE FUNCTION get_yearly_goal(p_year INT)
RETURNS TABLE(revenue_goal DECIMAL, projects_goal INT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(rg.revenue_goal), 0::DECIMAL) as revenue_goal,
    COALESCE(SUM(rg.projects_goal), 0)::INT as projects_goal
  FROM revenue_goals rg
  WHERE rg.year = p_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
