// Odoo 18 JSON-RPC API Types
// READ-ONLY integration - no write types defined by design

// ============================================================
// JSON-RPC Envelope Types
// ============================================================

export interface OdooJsonRpcRequest {
  jsonrpc: '2.0';
  method: 'call';
  id: number;
  params: {
    service: 'common' | 'object';
    method: string;
    args: unknown[];
  };
}

export interface OdooJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: {
      name: string;
      message: string;
      debug: string;
    };
  };
}

// ============================================================
// Raw Odoo Model Types (as returned by JSON-RPC)
// Note: Odoo uses `false` instead of `null` for empty fields
// ============================================================

/** sale.order model */
export interface OdooSalesOrder {
  id: number;
  name: string; // e.g. "S12345"
  partner_id: [number, string]; // Many2one: [id, display_name]
  amount_total: number;
  client_order_ref: string | false; // Customer PO number
  user_id: [number, string] | false; // Salesperson
  invoice_status: string; // "no" | "to invoice" | "invoiced"
  order_line: number[]; // IDs of sale.order.line records
}

/** sale.order.line model */
export interface OdooOrderLine {
  id: number;
  product_id: [number, string] | false;
  name: string; // Description/line item text
  product_uom_qty: number;
  price_subtotal: number;
}

/** res.partner model */
export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  child_ids: number[]; // Contact person IDs under a company
}

// ============================================================
// Transformed Types for AmiDash Consumption
// ============================================================

export interface OdooPullResult {
  salesOrder: {
    odooOrderId: number;
    salesOrderUrl: string;
    salesAmount: number;
    poNumber: string | null;
    invoiceStatus: string;
  };
  client: {
    name: string;
    pocName: string | null;
    pocEmail: string | null;
    pocPhone: string | null;
  };
  salesperson: {
    odooName: string;
    matchedProfileId: string | null; // Matched AmiDash profile ID
  };
  lineItems: Array<{
    productName: string;
    quantity: number;
    description: string;
    subtotal: number;
  }>;
}

// ============================================================
// Read-Only Method Types (safety enforcement)
// ============================================================

/** Only these Odoo ORM methods are allowed */
export type AllowedOdooMethod = 'search_read' | 'read' | 'fields_get';

export const ALLOWED_ODOO_METHODS: readonly AllowedOdooMethod[] = [
  'search_read',
  'read',
  'fields_get',
] as const;
