-- Migration: Add user preferences and require sales order numbers
-- This migration adds:
-- 1. user_preferences JSONB column to profiles for storing table/filter preferences
-- 2. timezone column to profiles
-- 3. Migrates existing projects without sales order numbers to use placeholders
-- 4. Makes sales_order_number required

-- Add user_preferences JSONB column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS user_preferences JSONB DEFAULT '{}'::jsonb;

-- Add timezone column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Create index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_preferences
ON profiles USING gin (user_preferences);

-- Migrate existing projects without sales order numbers
-- Generate temporary placeholders: S1TMP1, S1TMP2, etc.
DO $$
DECLARE
    counter INTEGER := 1;
    project_record RECORD;
    new_sales_order TEXT;
BEGIN
    FOR project_record IN
        SELECT id FROM projects
        WHERE sales_order_number IS NULL
           OR sales_order_number = ''
        ORDER BY created_at
    LOOP
        new_sales_order := 'S1TMP' || counter;
        UPDATE projects
        SET sales_order_number = new_sales_order
        WHERE id = project_record.id;
        RAISE NOTICE 'Updated project % with sales order %', project_record.id, new_sales_order;
        counter := counter + 1;
    END LOOP;

    IF counter > 1 THEN
        RAISE NOTICE 'Migrated % projects with temporary sales order numbers', counter - 1;
    ELSE
        RAISE NOTICE 'No projects needed migration';
    END IF;
END $$;

-- Make sales_order_number NOT NULL after migration
ALTER TABLE projects
ALTER COLUMN sales_order_number SET NOT NULL;

-- Add default constraint for new projects
ALTER TABLE projects
ALTER COLUMN sales_order_number SET DEFAULT '';

-- Create index for fast lookups by sales order number (for URL routing)
CREATE INDEX IF NOT EXISTS idx_projects_sales_order_lookup
ON projects (sales_order_number);

-- Add comment for documentation
COMMENT ON COLUMN profiles.user_preferences IS
'User preferences JSON structure:
{
  "projects_table": {
    "columns": { "column_id": true/false, ... },
    "column_widths": { "column_id": number, ... }
  },
  "projects_filter": {
    "statuses": ["status_id", ...],
    "contract_type": "type",
    "salesperson_id": "uuid",
    "project_type_id": "uuid",
    "tags": ["tag_id", ...],
    "date_type": "created" | "goal",
    "date_presets": ["this_month", "q1", ...],
    "date_years": ["2025", ...],
    "overdue": boolean
  }
}';

COMMENT ON COLUMN profiles.timezone IS 'User timezone for calendar and date displays (e.g., America/New_York)';
