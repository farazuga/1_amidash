import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../invoice-status/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/odoo', () => ({
  getOdooClient: vi.fn(),
  isOdooConfigured: vi.fn(),
}));

vi.mock('@/lib/odoo/queries', () => ({
  getInvoiceStatus: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { isOdooConfigured } from '@/lib/odoo';
import { getInvoiceStatus } from '@/lib/odoo/queries';

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockIsOdooConfigured = isOdooConfigured as ReturnType<typeof vi.fn>;
const mockGetInvoiceStatus = getInvoiceStatus as ReturnType<typeof vi.fn>;

function makeRequest(orderId?: string) {
  const url = orderId
    ? `http://localhost/api/odoo/invoice-status?orderId=${orderId}`
    : 'http://localhost/api/odoo/invoice-status';
  return new NextRequest(url);
}

describe('GET /api/odoo/invoice-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const response = await GET(makeRequest('42'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 200 with error when Odoo is not configured', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsOdooConfigured.mockReturnValue(false);

    const response = await GET(makeRequest('42'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('Odoo is not configured');
  });

  it('returns 400 when orderId is missing', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('orderId');
  });

  it('returns 400 when orderId is not a positive integer', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsOdooConfigured.mockReturnValue(true);

    const response = await GET(makeRequest('-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('positive integer');
  });

  it('returns 404 when order not found', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsOdooConfigured.mockReturnValue(true);
    mockGetInvoiceStatus.mockResolvedValue(null);

    const response = await GET(makeRequest('999'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('returns invoice status on success', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    mockIsOdooConfigured.mockReturnValue(true);
    mockGetInvoiceStatus.mockResolvedValue('invoiced');

    const response = await GET(makeRequest('42'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invoiceStatus).toBe('invoiced');
    expect(data.syncedAt).toBeDefined();
  });
});
