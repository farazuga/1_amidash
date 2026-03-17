/**
 * Odoo Domain-Specific Query Functions
 *
 * Higher-level functions that compose searchRead/read calls into
 * the shapes AmiDash needs. Isolates Odoo model knowledge from API routes.
 */

import type { OdooReadOnlyClient } from './client';
import type {
  OdooSalesOrder,
  OdooOrderLine,
  OdooPartner,
  OdooShippingPartner,
  OdooProduct,
  OdooAccount,
  OdooMoveLine,
  OdooActivity,
  OdooUser,
} from '@/types/odoo';

// ============================================================
// Sales Orders
// ============================================================

/**
 * Find a sales order by its number (e.g. "S12345").
 * Returns null if not found.
 */
export async function findSalesOrderByNumber(
  client: OdooReadOnlyClient,
  salesOrderNumber: string
): Promise<OdooSalesOrder | null> {
  const results = await client.searchRead<OdooSalesOrder>(
    'sale.order',
    [['name', '=', salesOrderNumber]],
    [
      'id',
      'name',
      'partner_id',
      'amount_total',
      'client_order_ref',
      'user_id',
      'invoice_status',
      'order_line',
    ],
    { limit: 1 }
  );

  return results.length > 0 ? results[0] : null;
}

/**
 * Get the invoice status for a specific sales order by Odoo ID.
 */
export async function getInvoiceStatus(
  client: OdooReadOnlyClient,
  orderId: number
): Promise<string | null> {
  const results = await client.read<Pick<OdooSalesOrder, 'id' | 'invoice_status'>>(
    'sale.order',
    [orderId],
    ['invoice_status']
  );

  return results.length > 0 ? results[0].invoice_status : null;
}

// ============================================================
// Order Lines
// ============================================================

/**
 * Read order line details by their IDs.
 */
export async function getSalesOrderLines(
  client: OdooReadOnlyClient,
  lineIds: number[]
): Promise<OdooOrderLine[]> {
  if (lineIds.length === 0) return [];

  return client.read<OdooOrderLine>(
    'sale.order.line',
    lineIds,
    ['id', 'product_id', 'name', 'product_uom_qty', 'price_subtotal', 'display_type']
  );
}

/**
 * Get product details (including internal reference/default_code) by IDs.
 * Used to look up codes like "ami_VIDPOD".
 */
export async function getProductDetails(
  client: OdooReadOnlyClient,
  productIds: number[]
): Promise<OdooProduct[]> {
  if (productIds.length === 0) return [];

  return client.read<OdooProduct>(
    'product.product',
    productIds,
    ['id', 'default_code', 'name']
  );
}

// ============================================================
// Partners / Contacts
// ============================================================

/**
 * Get partner (customer) details by ID.
 */
export async function getPartnerDetails(
  client: OdooReadOnlyClient,
  partnerId: number
): Promise<OdooPartner | null> {
  const results = await client.read<OdooPartner>(
    'res.partner',
    [partnerId],
    ['id', 'name', 'email', 'phone', 'mobile', 'child_ids']
  );

  return results.length > 0 ? results[0] : null;
}

/**
 * Get contact persons under a company partner.
 * In Odoo, company contacts have type "contact" and parent_id = the company.
 */
export async function getPartnerContacts(
  client: OdooReadOnlyClient,
  parentId: number
): Promise<OdooPartner[]> {
  return client.searchRead<OdooPartner>(
    'res.partner',
    [
      ['parent_id', '=', parentId],
      ['type', '=', 'contact'],
    ],
    ['id', 'name', 'email', 'phone', 'mobile', 'child_ids'],
    { limit: 10 }
  );
}

/**
 * Get the shipping/delivery address partner for a sales order.
 */
export async function getShippingAddress(
  client: OdooReadOnlyClient,
  orderId: number
): Promise<OdooShippingPartner | null> {
  const orders = await client.read<{ id: number; partner_shipping_id: [number, string] | false }>(
    'sale.order',
    [orderId],
    ['partner_shipping_id']
  );

  if (orders.length === 0 || !orders[0].partner_shipping_id) return null;

  const shippingPartnerId = orders[0].partner_shipping_id[0];

  const results = await client.read<OdooShippingPartner>(
    'res.partner',
    [shippingPartnerId],
    ['id', 'name', 'street', 'street2', 'city', 'state_id', 'zip', 'country_id']
  );

  return results.length > 0 ? results[0] : null;
}

/**
 * Search for partners (contacts and companies) by name for client name autocomplete.
 * Searches all res.partner records — both companies and individual contacts.
 */
export async function searchPartners(
  client: OdooReadOnlyClient,
  searchTerm: string,
  limit: number = 10
): Promise<Array<{ id: number; name: string; email: string | false; phone: string | false; is_company: boolean; street: string | false; city: string | false; state_id: [number, string] | false; zip: string | false; country_id: [number, string] | false }>> {
  return client.searchRead<{ id: number; name: string; email: string | false; phone: string | false; is_company: boolean; street: string | false; city: string | false; state_id: [number, string] | false; zip: string | false; country_id: [number, string] | false }>(
    'res.partner',
    [
      ['name', 'ilike', searchTerm],
    ],
    ['id', 'name', 'email', 'phone', 'is_company', 'street', 'city', 'state_id', 'zip', 'country_id'],
    { limit }
  );
}

// ============================================================
// Accounting
// ============================================================

/**
 * Look up an accounting account by its code (e.g. "1200").
 * Returns the account if found, null otherwise.
 */
export async function findAccountByCode(
  client: OdooReadOnlyClient,
  accountCode: string
): Promise<OdooAccount | null> {
  const results = await client.searchRead<OdooAccount>(
    'account.account',
    [['code', '=', accountCode]],
    ['id', 'code', 'name'],
    { limit: 1 }
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Get the net movement (sum of balance) for journal entries on a specific
 * account within a date range (inclusive). Only includes posted entries.
 * Used for "date_range" mode in the scorecard.
 */
export async function getAccountMovement(
  client: OdooReadOnlyClient,
  accountCode: string,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string // YYYY-MM-DD
): Promise<number> {
  const lines = await client.searchRead<OdooMoveLine>(
    'account.move.line',
    [
      ['account_id.code', '=', accountCode],
      ['date', '>=', dateFrom],
      ['date', '<=', dateTo],
      ['parent_state', '=', 'posted'],
    ],
    ['balance']
  );
  return lines.reduce((sum, line) => sum + (line.balance || 0), 0);
}

/**
 * Get the cumulative balance for an account as-of a specific date.
 * Sums all posted journal items on or before the given date.
 * Used for "last_day" mode in the scorecard.
 */
export async function getAccountBalance(
  client: OdooReadOnlyClient,
  accountCode: string,
  asOfDate: string // YYYY-MM-DD
): Promise<number> {
  const lines = await client.searchRead<OdooMoveLine>(
    'account.move.line',
    [
      ['account_id.code', '=', accountCode],
      ['date', '<=', asOfDate],
      ['parent_state', '=', 'posted'],
    ],
    ['balance']
  );
  return lines.reduce((sum, line) => sum + (line.balance || 0), 0);
}

// ============================================================
// Quotes (Quotations)
// ============================================================

/**
 * Get the total value of open (non-expired, non-confirmed) quotes as of a date.
 * In Odoo, quotes are sale.order with state in ('draft', 'sent').
 * "Not expired" means validity_date is false/null or >= asOfDate.
 * Returns the sum of amount_total for matching quotes.
 */
export async function getOpenQuotesTotal(
  client: OdooReadOnlyClient,
  asOfDate: string // YYYY-MM-DD
): Promise<number> {
  const domain = [
    ['state', 'in', ['draft', 'sent']],
    ['create_date', '<=', `${asOfDate} 23:59:59`],
    '|',
    ['validity_date', '=', false],
    ['validity_date', '>=', asOfDate],
  ] as unknown as unknown[][];

  const quotes = await client.searchRead<{
    id: number;
    amount_total: number;
    validity_date: string | false;
  }>(
    'sale.order',
    domain,
    ['id', 'amount_total', 'validity_date']
  );
  return quotes.reduce((sum, q) => sum + (q.amount_total || 0), 0);
}

// ============================================================
// Activities (Chatter Tasks)
// ============================================================

/**
 * Find an Odoo user by their email (login field).
 * Used to match AmiDash users to Odoo users.
 */
export async function findOdooUserByEmail(
  client: OdooReadOnlyClient,
  email: string
): Promise<OdooUser | null> {
  const results = await client.searchRead<OdooUser>(
    'res.users',
    [['login', '=', email]],
    ['id', 'login', 'name'],
    { limit: 1 }
  );

  return results.length > 0 ? results[0] : null;
}

const ACTIVITY_FIELDS = [
  'id',
  'summary',
  'note',
  'date_deadline',
  'activity_type_id',
  'user_id',
  'create_uid',
  'res_model',
  'res_id',
  'res_name',
] as const;

/**
 * Get all open activities assigned to an Odoo user.
 * Activities that exist are open — completed ones are deleted in Odoo.
 */
export async function getUserActivities(
  client: OdooReadOnlyClient,
  odooUserId: number
): Promise<OdooActivity[]> {
  return client.searchRead<OdooActivity>(
    'mail.activity',
    [['user_id', '=', odooUserId]],
    [...ACTIVITY_FIELDS],
    { order: 'date_deadline asc' }
  );
}

/**
 * Get all open activities created by an Odoo user but assigned to others.
 * These are tasks the user has delegated to other people.
 */
export async function getActivitiesAssignedByUser(
  client: OdooReadOnlyClient,
  odooUserId: number
): Promise<OdooActivity[]> {
  return client.searchRead<OdooActivity>(
    'mail.activity',
    [
      ['create_uid', '=', odooUserId],
      ['user_id', '!=', odooUserId],
    ],
    [...ACTIVITY_FIELDS],
    { order: 'date_deadline asc' }
  );
}

// ============================================================
// URL Construction
// ============================================================

/**
 * Build the Odoo web URL for a sales order.
 * Odoo 18 format: {base_url}/odoo/sales/{order_id}
 */
export function buildOdooUrl(baseUrl: string, orderId: number): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/odoo/sales/${orderId}`;
}

/**
 * Build the Odoo web URL for any record.
 * Generic format: {base_url}/web#id={recordId}&model={model}&view_type=form
 */
export function buildOdooRecordUrl(
  baseUrl: string,
  model: string,
  recordId: number
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/web#id=${recordId}&model=${model}&view_type=form`;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Convert Odoo's `false` sentinel to null.
 * Odoo uses `false` instead of `null` for empty/unset fields.
 */
export function odooFalseToNull<T>(value: T | false): T | null {
  return value === false ? null : value;
}

/**
 * Extract the display name from an Odoo Many2one field.
 * Many2one fields return as [id, "Display Name"] or false.
 */
export function odooMany2oneName(
  value: [number, string] | false
): string | null {
  if (value === false) return null;
  return value[1];
}

/**
 * Extract the ID from an Odoo Many2one field.
 */
export function odooMany2oneId(
  value: [number, string] | false
): number | null {
  if (value === false) return null;
  return value[0];
}

/**
 * Format an Odoo phone number for AmiDash.
 * Strips +1 prefix and formats as xxx-xxx-xxxx.
 */
export function formatOdooPhone(phone: string | false): string | null {
  if (!phone || phone === '') return null;
  // Strip +1 prefix
  let cleaned = phone.replace(/^\+1\s*/, '').replace(/^1(?=\d{10})/, '');
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6, 10)}`;
  }
  return phone;
}

const US_STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
  'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
  'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

export function parseStateCode(stateId: [number, string] | false): string | null {
  if (!stateId) return null;
  const stateName = stateId[1];
  if (/^[A-Z]{2}$/.test(stateName)) return stateName;
  return US_STATE_ABBREVS[stateName] || stateName;
}

const COUNTRY_CODES: Record<string, string> = {
  'United States': 'US', 'Canada': 'CA', 'Mexico': 'MX',
  'United Kingdom': 'GB',
};

export function parseCountryCode(countryId: [number, string] | false): string | null {
  if (!countryId) return null;
  const countryName = countryId[1];
  if (/^[A-Z]{2}$/.test(countryName)) return countryName;
  return COUNTRY_CODES[countryName] || countryName;
}
