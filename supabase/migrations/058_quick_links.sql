-- Quick Links: categories (self-referencing for subcategories) and items

-- Categories table
CREATE TABLE IF NOT EXISTS quick_link_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES quick_link_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Items table
CREATE TABLE IF NOT EXISTS quick_link_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES quick_link_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Auto-update timestamps
CREATE TRIGGER update_quick_link_categories_updated_at
  BEFORE UPDATE ON quick_link_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quick_link_items_updated_at
  BEFORE UPDATE ON quick_link_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE quick_link_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_link_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can view categories"
  ON quick_link_categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view items"
  ON quick_link_items FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage categories"
  ON quick_link_categories FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage items"
  ON quick_link_items FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Indexes
CREATE INDEX idx_quick_link_categories_parent ON quick_link_categories(parent_id);
CREATE INDEX idx_quick_link_categories_sort ON quick_link_categories(sort_order);
CREATE INDEX idx_quick_link_items_category ON quick_link_items(category_id);
CREATE INDEX idx_quick_link_items_sort ON quick_link_items(sort_order);
