-- Seed default statuses
INSERT INTO statuses (name, display_order, require_note, is_active) VALUES
  ('PO Received', 1, false, true),
  ('Engineering Review', 2, false, true),
  ('In Procurement', 3, false, true),
  ('Pending Scheduling', 4, false, true),
  ('Scheduled', 5, false, true),
  ('IP', 6, false, true),
  ('Hold', 7, true, true),
  ('Invoiced', 8, false, true);

-- Seed default project type
INSERT INTO project_types (name, display_order, is_active) VALUES
  ('Default', 1, true);

-- Assign all statuses to default project type
INSERT INTO project_type_statuses (project_type_id, status_id)
SELECT
  (SELECT id FROM project_types WHERE name = 'Default'),
  id
FROM statuses;
