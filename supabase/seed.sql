-- Seed default statuses
INSERT INTO statuses (name, display_order, progress_percent, require_note, is_active) VALUES
  ('PO Received', 1, 12, false, true),
  ('Engineering Review', 2, 25, false, true),
  ('In Procurement', 3, 37, false, true),
  ('Pending Scheduling', 4, 50, false, true),
  ('Scheduled', 5, 62, false, true),
  ('IP', 6, 75, false, true),
  ('Hold', 7, 75, true, true),
  ('Invoiced', 8, 100, false, true);
