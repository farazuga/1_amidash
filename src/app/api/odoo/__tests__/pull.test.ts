import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../pull/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/odoo', () => ({
  getOdooClient: vi.fn(),
  isOdooConfigured: vi.fn(),
}));

vi.mock('@/lib/odoo/queries', () => ({
  findSalesOrderByNumber: vi.fn(),
  getSalesOrderLines: vi.fn(),
  getProductDetails: vi.fn(),
  getPartnerDetails: vi.fn(),
  getPartnerContacts: vi.fn(),
  buildOdooUrl: vi.fn(),
  odooFalseToNull: vi.fn((v: unknown) => (v === false ? null : v)),
  odooMany2oneName: vi.fn((v: unknown) => (v === false ? null : (v as [number, string])[1])),
  formatOdooPhone: vi.fn((v: unknown) => (v === false || !v ? null : v)),
}));

import { createClient } from '@/lib/supabase/server';
import { isOdooConfigured } from '@/lib/odoo';
import {
  findSalesOrderByNumber,
  getSalesOrderLines,
  getProductDetails,
  getPartnerDetails,
  getPartnerContacts,
  buildOdooUrl,
} from '@/lib/odoo/queries';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockIsOdooConfigured = isOdooConfigured as ReturnType<typeof vi.fn>;
const mockFindSalesOrderByNumber = findSalesOrderByNumber as ReturnType<typeof vi.fn>;
const mockGetSalesOrderLines = getSalesOrderLines as ReturnType<typeof vi.fn>;
const mockGetProductDetails = getProductDetails as ReturnType<typeof vi.fn>;
const mockGetPartnerDetails = getPartnerDetails as ReturnType<typeof vi.fn>;
const mockGetPartnerContacts = getPartnerContacts as ReturnType<typeof vi.fn>;
const mockBuildOdooUrl = buildOdooUrl as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/odoo/pull', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockAuthenticatedSupabase(profileResults: unknown[] = []) {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      ilike: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: profileResults }),
        }),
      }),
    }),
  });

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: mockFrom,
  });
}

describe('POST /api/odoo/pull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ODOO_URL = 'https://test.odoo.com';
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const response = await POST(makeRequest({ salesOrderNumber: 'S12345' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 200 with error when Odoo is not configured', async () => {
    mockAuthenticatedSupabase();
    mockIsOdooConfigured.mockReturnValue(false);

    const response = await POST(makeRequest({ salesOrderNumber: 'S12345' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('Odoo is not configured');
  });

  it('returns 400 for missing salesOrderNumber', async () => {
    mockAuthenticatedSupabase();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('salesOrderNumber is required');
  });

  it('returns 400 for invalid sales order format', async () => {
    mockAuthenticatedSupabase();
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await POST(makeRequest({ salesOrderNumber: 'ABC' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('S1XXXX format');
  });

  it('returns 404 when order not found in Odoo', async () => {
    mockAuthenticatedSupabase();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindSalesOrderByNumber.mockResolvedValue(null);

    const response = await POST(makeRequest({ salesOrderNumber: 'S19999' }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found in Odoo');
  });

  it('returns full OdooPullResult on success', async () => {
    mockAuthenticatedSupabase([{ id: 'profile-1', full_name: 'Jane Doe' }]);
    mockIsOdooConfigured.mockReturnValue(true);

    mockFindSalesOrderByNumber.mockResolvedValue({
      id: 42,
      name: 'S12345',
      partner_id: [10, 'Test Company'],
      amount_total: 5000,
      client_order_ref: 'PO-001',
      user_id: [5, 'Jane Doe'],
      invoice_status: 'to invoice',
      order_line: [1, 2],
    });

    mockGetPartnerDetails.mockResolvedValue({
      id: 10,
      name: 'Test Company',
      email: 'info@test.com',
      phone: '555-123-4567',
      mobile: false,
      child_ids: [11],
    });

    mockGetPartnerContacts.mockResolvedValue([
      {
        id: 11,
        name: 'John Doe',
        email: 'john@test.com',
        phone: '555-111-2222',
        mobile: false,
        child_ids: [],
      },
    ]);

    mockGetSalesOrderLines.mockResolvedValue([
      { id: 1, product_id: [100, 'Widget A'], name: 'Widget A - Custom', product_uom_qty: 5, price_subtotal: 500 },
      { id: 2, product_id: [101, 'Widget B'], name: 'Widget B', product_uom_qty: 2, price_subtotal: 200 },
    ]);

    mockGetProductDetails.mockResolvedValue([
      { id: 100, default_code: 'WIDGET_A' },
      { id: 101, default_code: false },
    ]);

    mockBuildOdooUrl.mockReturnValue('https://test.odoo.com/odoo/sales/42');

    const response = await POST(makeRequest({ salesOrderNumber: 'S12345' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.salesOrder.odooOrderId).toBe(42);
    expect(data.salesOrder.salesAmount).toBe(5000);
    expect(data.salesOrder.poNumber).toBe('PO-001');
    expect(data.salesOrder.invoiceStatus).toBe('to invoice');
    expect(data.client.name).toBe('Test Company');
    expect(data.client.pocName).toBe('John Doe');
    expect(data.salesperson.odooName).toBe('Jane Doe');
    expect(data.salesperson.matchedProfileId).toBe('profile-1');
    expect(data.lineItems).toHaveLength(2);
  });

  it('handles Odoo API errors gracefully', async () => {
    mockAuthenticatedSupabase();
    mockIsOdooConfigured.mockReturnValue(true);
    mockFindSalesOrderByNumber.mockRejectedValue(new Error('Odoo connection refused'));

    const response = await POST(makeRequest({ salesOrderNumber: 'S12345' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Odoo connection refused');
  });
});
