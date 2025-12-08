-- Add unique constraint on sales_order_number
-- Note: NULL values are allowed and not considered duplicates in PostgreSQL unique constraints

-- First, create a unique index that only applies to non-null values
CREATE UNIQUE INDEX idx_projects_sales_order_number_unique
ON projects (sales_order_number)
WHERE sales_order_number IS NOT NULL AND sales_order_number != '';
