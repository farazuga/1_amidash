-- Migration: Per Diem Tracker
-- Three tables: per_diem_rates (admin setting), per_diem_deposits, per_diem_entries

-- ============================================================
-- 1. per_diem_rates — single-row admin setting for daily rates
-- ============================================================
CREATE TABLE IF NOT EXISTS per_diem_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  in_state_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  out_of_state_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with one default row
INSERT INTO per_diem_rates (in_state_rate, out_of_state_rate) VALUES (0, 0);

-- Auto-update timestamp
CREATE TRIGGER update_per_diem_rates_updated_at
  BEFORE UPDATE ON per_diem_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE per_diem_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view per diem rates"
  ON per_diem_rates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can update per diem rates"
  ON per_diem_rates FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- 2. per_diem_deposits — admin-managed deposits per user
-- ============================================================
CREATE TABLE IF NOT EXISTS per_diem_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index on user_id
CREATE INDEX idx_per_diem_deposits_user_id ON per_diem_deposits(user_id);

-- Auto-update timestamp
CREATE TRIGGER update_per_diem_deposits_updated_at
  BEFORE UPDATE ON per_diem_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE per_diem_deposits ENABLE ROW LEVEL SECURITY;

-- Users can view their own deposits, admins can view all
CREATE POLICY "Users can view own deposits"
  ON per_diem_deposits FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Only admins can insert deposits
CREATE POLICY "Admins can insert deposits"
  ON per_diem_deposits FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Only admins can update deposits
CREATE POLICY "Admins can update deposits"
  ON per_diem_deposits FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Only admins can delete deposits
CREATE POLICY "Admins can delete deposits"
  ON per_diem_deposits FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- 3. per_diem_entries — individual per diem claims
-- ============================================================
CREATE TABLE IF NOT EXISTS per_diem_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_other_note TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INTEGER NOT NULL,
  nights_overridden BOOLEAN NOT NULL DEFAULT false,
  location_type TEXT NOT NULL CHECK (location_type IN ('in_state', 'out_of_state')),
  rate DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_per_diem_entries_user_id ON per_diem_entries(user_id);
CREATE INDEX idx_per_diem_entries_project_id ON per_diem_entries(project_id);
CREATE INDEX idx_per_diem_entries_status ON per_diem_entries(status);
CREATE INDEX idx_per_diem_entries_start_date ON per_diem_entries(start_date);

-- Auto-update timestamp
CREATE TRIGGER update_per_diem_entries_updated_at
  BEFORE UPDATE ON per_diem_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE per_diem_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own entries, admins can view all
CREATE POLICY "Users can view own entries"
  ON per_diem_entries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Users can insert entries for themselves, admins can insert for anyone
CREATE POLICY "Users can insert own entries or admin for anyone"
  ON per_diem_entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Users can update their own pending entries, admins can update any
CREATE POLICY "Users can update own pending entries or admin any"
  ON per_diem_entries FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR get_user_role(auth.uid()) = 'admin'
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'pending')
    OR get_user_role(auth.uid()) = 'admin'
  );

-- Users can delete their own pending entries, admins can delete any pending
CREATE POLICY "Users can delete own pending entries or admin any pending"
  ON per_diem_entries FOR DELETE TO authenticated
  USING (
    (status = 'pending' AND user_id = auth.uid())
    OR (status = 'pending' AND get_user_role(auth.uid()) = 'admin')
  );
