import { describe, it, expect, vi } from 'vitest';
import {
  findSalesOrderByNumber,
  getSalesOrderLines,
  getPartnerDetails,
  getPartnerContacts,
  getInvoiceStatus,
  buildOdooUrl,
  odooFalseToNull,
  odooMany2oneName,
  odooMany2oneId,
  formatOdooPhone,
} from '../queries';
import type { OdooReadOnlyClient } from '../client';
import type { OdooSalesOrder, OdooOrderLine, OdooPartner } from '@/types/odoo';

// Create a mock client
function createMockClient() {
  return {
    searchRead: vi.fn(),
    read: vi.fn(),
  } as unknown as OdooReadOnlyClient & {
    searchRead: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
}

describe('Odoo Queries', () => {
  // ============================================================
  // findSalesOrderByNumber
  // ============================================================

  describe('findSalesOrderByNumber', () => {
    it('returns sales order when found', async () => {
      const client = createMockClient();
      const mockOrder: OdooSalesOrder = {
        id: 42,
        name: 'S12345',
        partner_id: [10, 'Test Client'],
        amount_total: 5000.0,
        client_order_ref: 'PO-001',
        user_id: [5, 'Jane Doe'],
        invoice_status: 'to invoice',
        order_line: [1, 2, 3],
      };
      client.searchRead.mockResolvedValue([mockOrder]);

      const result = await findSalesOrderByNumber(client, 'S12345');

      expect(result).toEqual(mockOrder);
      expect(client.searchRead).toHaveBeenCalledWith(
        'sale.order',
        [['name', '=', 'S12345']],
        expect.arrayContaining(['id', 'name', 'partner_id', 'amount_total']),
        { limit: 1 }
      );
    });

    it('returns null when not found', async () => {
      const client = createMockClient();
      client.searchRead.mockResolvedValue([]);

      const result = await findSalesOrderByNumber(client, 'S19999');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // getInvoiceStatus
  // ============================================================

  describe('getInvoiceStatus', () => {
    it('returns invoice status for existing order', async () => {
      const client = createMockClient();
      client.read.mockResolvedValue([{ id: 42, invoice_status: 'invoiced' }]);

      const result = await getInvoiceStatus(client, 42);

      expect(result).toBe('invoiced');
      expect(client.read).toHaveBeenCalledWith('sale.order', [42], ['invoice_status']);
    });

    it('returns null when order not found', async () => {
      const client = createMockClient();
      client.read.mockResolvedValue([]);

      const result = await getInvoiceStatus(client, 999);

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // getSalesOrderLines
  // ============================================================

  describe('getSalesOrderLines', () => {
    it('returns order lines for given IDs', async () => {
      const client = createMockClient();
      const mockLines: OdooOrderLine[] = [
        { id: 1, product_id: [100, 'Widget A'], name: 'Widget A - Custom', product_uom_qty: 5, price_subtotal: 500, display_type: false },
        { id: 2, product_id: [101, 'Widget B'], name: 'Widget B - Standard', product_uom_qty: 2, price_subtotal: 200, display_type: false },
      ];
      client.read.mockResolvedValue(mockLines);

      const result = await getSalesOrderLines(client, [1, 2]);

      expect(result).toEqual(mockLines);
      expect(client.read).toHaveBeenCalledWith(
        'sale.order.line',
        [1, 2],
        ['id', 'product_id', 'name', 'product_uom_qty', 'price_subtotal', 'display_type']
      );
    });

    it('returns empty array for empty IDs', async () => {
      const client = createMockClient();

      const result = await getSalesOrderLines(client, []);

      expect(result).toEqual([]);
      expect(client.read).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getPartnerDetails
  // ============================================================

  describe('getPartnerDetails', () => {
    it('returns partner when found', async () => {
      const client = createMockClient();
      const mockPartner: OdooPartner = {
        id: 10,
        name: 'Test Company',
        email: 'info@test.com',
        phone: '+1 555-123-4567',
        mobile: false,
        child_ids: [11, 12],
      };
      client.read.mockResolvedValue([mockPartner]);

      const result = await getPartnerDetails(client, 10);

      expect(result).toEqual(mockPartner);
    });

    it('returns null when not found', async () => {
      const client = createMockClient();
      client.read.mockResolvedValue([]);

      const result = await getPartnerDetails(client, 999);

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // getPartnerContacts
  // ============================================================

  describe('getPartnerContacts', () => {
    it('searches for contact-type children of parent', async () => {
      const client = createMockClient();
      const mockContacts: OdooPartner[] = [
        { id: 11, name: 'John Doe', email: 'john@test.com', phone: '555-111-2222', mobile: false, child_ids: [] },
      ];
      client.searchRead.mockResolvedValue(mockContacts);

      const result = await getPartnerContacts(client, 10);

      expect(result).toEqual(mockContacts);
      expect(client.searchRead).toHaveBeenCalledWith(
        'res.partner',
        [['parent_id', '=', 10], ['type', '=', 'contact']],
        expect.arrayContaining(['id', 'name', 'email', 'phone']),
        { limit: 10 }
      );
    });
  });

  // ============================================================
  // buildOdooUrl
  // ============================================================

  describe('buildOdooUrl', () => {
    it('constructs correct Odoo 18 sales order URL', () => {
      expect(buildOdooUrl('https://mycompany.odoo.com', 42)).toBe(
        'https://mycompany.odoo.com/odoo/sales/42'
      );
    });

    it('strips trailing slash from base URL', () => {
      expect(buildOdooUrl('https://mycompany.odoo.com/', 42)).toBe(
        'https://mycompany.odoo.com/odoo/sales/42'
      );
    });
  });

  // ============================================================
  // Helper functions
  // ============================================================

  describe('odooFalseToNull', () => {
    it('converts false to null', () => {
      expect(odooFalseToNull(false)).toBeNull();
    });

    it('passes through truthy values', () => {
      expect(odooFalseToNull('hello')).toBe('hello');
      expect(odooFalseToNull(42)).toBe(42);
    });

    it('passes through empty string', () => {
      expect(odooFalseToNull('')).toBe('');
    });
  });

  describe('odooMany2oneName', () => {
    it('extracts display name from Many2one', () => {
      expect(odooMany2oneName([10, 'Test Company'])).toBe('Test Company');
    });

    it('returns null for false', () => {
      expect(odooMany2oneName(false)).toBeNull();
    });
  });

  describe('odooMany2oneId', () => {
    it('extracts ID from Many2one', () => {
      expect(odooMany2oneId([10, 'Test Company'])).toBe(10);
    });

    it('returns null for false', () => {
      expect(odooMany2oneId(false)).toBeNull();
    });
  });

  describe('formatOdooPhone', () => {
    it('formats +1 prefixed phone', () => {
      expect(formatOdooPhone('+1 5551234567')).toBe('555-123-4567');
    });

    it('formats plain 10-digit phone', () => {
      expect(formatOdooPhone('5551234567')).toBe('555-123-4567');
    });

    it('formats phone with dashes', () => {
      expect(formatOdooPhone('555-123-4567')).toBe('555-123-4567');
    });

    it('returns null for false', () => {
      expect(formatOdooPhone(false)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(formatOdooPhone('')).toBeNull();
    });

    it('returns original for short numbers', () => {
      expect(formatOdooPhone('12345')).toBe('12345');
    });
  });
});
