-- Add 'odoo_quotes' to the auto_source CHECK constraint
-- for pulling total value of open quotes from Odoo.

ALTER TABLE l10_scorecard_measurables
  DROP CONSTRAINT IF EXISTS l10_scorecard_measurables_auto_source_check;

ALTER TABLE l10_scorecard_measurables
  ADD CONSTRAINT l10_scorecard_measurables_auto_source_check
  CHECK (auto_source IN ('po_revenue', 'invoiced_revenue', 'open_projects', 'odoo_account', 'odoo_quotes'));
