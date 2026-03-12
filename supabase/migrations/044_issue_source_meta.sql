-- Add source_meta JSONB column to l10_issues for storing project context
ALTER TABLE l10_issues ADD COLUMN source_meta JSONB;
