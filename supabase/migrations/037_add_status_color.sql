-- Add color column to statuses table
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';

-- Seed existing statuses with their current hardcoded colors
UPDATE statuses SET color = '#3b82f6' WHERE name = 'PO Received';
UPDATE statuses SET color = '#8b5cf6' WHERE name = 'Engineering Review';
UPDATE statuses SET color = '#06b6d4' WHERE name = 'In Procurement';
UPDATE statuses SET color = '#eab308' WHERE name = 'Pending Scheduling';
UPDATE statuses SET color = '#f97316' WHERE name = 'Scheduled';
UPDATE statuses SET color = '#22c55e' WHERE name = 'IP';
UPDATE statuses SET color = '#ef4444' WHERE name = 'Hold';
UPDATE statuses SET color = '#10b981' WHERE name = 'Invoiced';
