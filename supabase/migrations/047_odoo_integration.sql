-- Odoo Integration
-- Adds columns to store Odoo sales order reference and sync metadata
-- READ-ONLY integration: AmiDash only pulls data from Odoo, never writes

-- Odoo's internal sales order ID (for follow-up API calls like invoice status refresh)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS odoo_order_id INTEGER;

-- Invoice status from Odoo (values: "no", "to invoice", "invoiced")
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS odoo_invoice_status TEXT;

-- Timestamp of last Odoo data pull
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS odoo_last_synced_at TIMESTAMPTZ;

-- LLM-generated project summary from Odoo order line items
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_description TEXT;

-- Index for Odoo order ID lookups
CREATE INDEX IF NOT EXISTS idx_projects_odoo_order_id
ON projects (odoo_order_id)
WHERE odoo_order_id IS NOT NULL;

COMMENT ON COLUMN projects.odoo_order_id IS 'Odoo sales order internal ID for API calls';
COMMENT ON COLUMN projects.odoo_invoice_status IS 'Invoice status from Odoo (no, to invoice, invoiced)';
COMMENT ON COLUMN projects.odoo_last_synced_at IS 'Timestamp of last data pull from Odoo';
COMMENT ON COLUMN projects.project_description IS 'LLM-generated project summary from Odoo order line items';
