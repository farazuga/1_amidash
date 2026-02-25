-- Add 'open_projects' to the auto_source CHECK constraint on l10_scorecard_measurables

-- Drop the existing CHECK constraint and recreate with the new value
ALTER TABLE l10_scorecard_measurables
  DROP CONSTRAINT IF EXISTS l10_scorecard_measurables_auto_source_check;

ALTER TABLE l10_scorecard_measurables
  ADD CONSTRAINT l10_scorecard_measurables_auto_source_check
  CHECK (auto_source IN ('po_revenue', 'invoiced_revenue', 'open_projects'));
