-- Add 'odoo_account' auto-source type and Odoo account configuration columns
-- to l10_scorecard_measurables for pulling accounting data from Odoo.

-- 1. Expand the auto_source CHECK constraint
ALTER TABLE l10_scorecard_measurables
  DROP CONSTRAINT IF EXISTS l10_scorecard_measurables_auto_source_check;

ALTER TABLE l10_scorecard_measurables
  ADD CONSTRAINT l10_scorecard_measurables_auto_source_check
  CHECK (auto_source IN ('po_revenue', 'invoiced_revenue', 'open_projects', 'odoo_account'));

-- 2. Add Odoo account configuration columns
ALTER TABLE l10_scorecard_measurables
  ADD COLUMN IF NOT EXISTS odoo_account_code TEXT,
  ADD COLUMN IF NOT EXISTS odoo_account_name TEXT,
  ADD COLUMN IF NOT EXISTS odoo_date_mode TEXT CHECK (odoo_date_mode IN ('date_range', 'last_day'));
