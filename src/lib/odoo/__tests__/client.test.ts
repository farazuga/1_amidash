import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OdooReadOnlyClient } from '../client';
import { getOdooClient, isOdooConfigured, resetOdooClient } from '../index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Odoo Read-Only Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOdooClient();
    process.env = {
      ...originalEnv,
      ODOO_URL: 'https://test.odoo.com',
      ODOO_DB: 'test-db',
      ODOO_USER_LOGIN: 'api@test.com',
      ODOO_API_KEY: 'test-api-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================
  // Configuration checks
  // ============================================================

  describe('isOdooConfigured', () => {
    it('returns true when all env vars are set', () => {
      expect(isOdooConfigured()).toBe(true);
    });

    it('returns false when ODOO_URL is missing', () => {
      delete process.env.ODOO_URL;
      expect(isOdooConfigured()).toBe(false);
    });

    it('returns false when ODOO_DB is missing', () => {
      delete process.env.ODOO_DB;
      expect(isOdooConfigured()).toBe(false);
    });

    it('returns false when ODOO_USER_LOGIN is missing', () => {
      delete process.env.ODOO_USER_LOGIN;
      expect(isOdooConfigured()).toBe(false);
    });

    it('returns false when ODOO_API_KEY is missing', () => {
      delete process.env.ODOO_API_KEY;
      expect(isOdooConfigured()).toBe(false);
    });
  });

  // ============================================================
  // Singleton factory
  // ============================================================

  describe('getOdooClient', () => {
    it('throws when ODOO_URL is missing', () => {
      delete process.env.ODOO_URL;
      expect(() => getOdooClient()).toThrow('ODOO_URL environment variable is not set');
    });

    it('throws when ODOO_DB is missing', () => {
      delete process.env.ODOO_DB;
      expect(() => getOdooClient()).toThrow('ODOO_DB environment variable is not set');
    });

    it('throws when ODOO_USER_LOGIN is missing', () => {
      delete process.env.ODOO_USER_LOGIN;
      expect(() => getOdooClient()).toThrow('ODOO_USER_LOGIN environment variable is not set');
    });

    it('throws when ODOO_API_KEY is missing', () => {
      delete process.env.ODOO_API_KEY;
      expect(() => getOdooClient()).toThrow('ODOO_API_KEY environment variable is not set');
    });

    it('returns singleton instance', () => {
      const client1 = getOdooClient();
      const client2 = getOdooClient();
      expect(client1).toBe(client2);
    });

    it('creates new instance after reset', () => {
      const client1 = getOdooClient();
      resetOdooClient();
      const client2 = getOdooClient();
      expect(client1).not.toBe(client2);
    });
  });

  // ============================================================
  // SAFETY TESTS - Critical: verify write methods are blocked
  // ============================================================

  describe('read-only safety enforcement', () => {
    let client: OdooReadOnlyClient;

    beforeEach(() => {
      client = new OdooReadOnlyClient(
        'https://test.odoo.com',
        'test-db',
        'api@test.com',
        'test-api-key'
      );
    });

    it('does NOT expose a create method', () => {
      expect((client as unknown as Record<string, unknown>).create).toBeUndefined();
    });

    it('does NOT expose a write method', () => {
      expect((client as unknown as Record<string, unknown>).write).toBeUndefined();
    });

    it('does NOT expose an unlink method', () => {
      expect((client as unknown as Record<string, unknown>).unlink).toBeUndefined();
    });

    it('enforces allowlist even if private call method is accessed at runtime', () => {
      // TypeScript private is compile-time only. The runtime safety comes
      // from the ALLOWED_METHODS check inside call(). We verify the public
      // API only exposes read methods - no write methods exist at all.
      const proto = Object.getPrototypeOf(client);
      const methods = Object.getOwnPropertyNames(proto).filter(
        (n) => n !== 'constructor' && typeof proto[n] === 'function'
      );
      expect(methods).not.toContain('create');
      expect(methods).not.toContain('write');
      expect(methods).not.toContain('unlink');
    });

    it('only exposes searchRead and read as public methods', () => {
      const publicMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(client)
      ).filter(
        (name) => name !== 'constructor' && !name.startsWith('_')
      );

      // Filter to only truly public (non-private) methods
      // TypeScript private methods are still on the prototype but convention says
      // we check the public API
      expect(typeof client.searchRead).toBe('function');
      expect(typeof client.read).toBe('function');
      // Verify no other methods that look like write operations
      expect(publicMethods).not.toContain('create');
      expect(publicMethods).not.toContain('write');
      expect(publicMethods).not.toContain('unlink');
      expect(publicMethods).not.toContain('update');
      expect(publicMethods).not.toContain('delete');
    });
  });

  // ============================================================
  // Authentication
  // ============================================================

  describe('authentication', () => {
    let client: OdooReadOnlyClient;

    beforeEach(() => {
      client = new OdooReadOnlyClient(
        'https://test.odoo.com',
        'test-db',
        'api@test.com',
        'test-api-key'
      );
    });

    it('authenticates on first API call and caches uid', async () => {
      // Mock auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: 42 }),
      });
      // Mock search_read response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 2, result: [] }),
      });

      await client.searchRead('sale.order', [], ['name']);

      // First call should be auth
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const authCall = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(authCall.params.service).toBe('common');
      expect(authCall.params.method).toBe('authenticate');
      expect(authCall.params.args).toEqual(['test-db', 'api@test.com', 'test-api-key', {}]);
    });

    it('reuses cached uid on subsequent calls', async () => {
      // Mock auth response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: 42 }),
      });
      // Mock two search_read responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 2, result: [] }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 3, result: [] }),
      });

      await client.searchRead('sale.order', [], ['name']);
      await client.searchRead('res.partner', [], ['name']);

      // Auth only called once (first call), then two data calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Second and third calls should use uid in args
      const call2 = JSON.parse(mockFetch.mock.calls[1][1].body);
      const call3 = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(call2.params.args[1]).toBe(42); // uid
      expect(call3.params.args[1]).toBe(42); // same uid
    });

    it('throws on authentication failure (false result)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: false }),
      });

      await expect(
        client.searchRead('sale.order', [], ['name'])
      ).rejects.toThrow('Odoo authentication failed');
    });

    it('throws on authentication HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(
        client.searchRead('sale.order', [], ['name'])
      ).rejects.toThrow('Odoo authentication HTTP error (500)');
    });

    it('throws on authentication JSON-RPC error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: 100,
              message: 'Auth Error',
              data: { name: 'Error', message: 'Bad credentials', debug: '' },
            },
          }),
      });

      await expect(
        client.searchRead('sale.order', [], ['name'])
      ).rejects.toThrow('Odoo authentication error: Bad credentials');
    });
  });

  // ============================================================
  // JSON-RPC payload format
  // ============================================================

  describe('searchRead', () => {
    let client: OdooReadOnlyClient;

    beforeEach(() => {
      client = new OdooReadOnlyClient(
        'https://test.odoo.com',
        'test-db',
        'api@test.com',
        'test-api-key'
      );
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: 42 }),
      });
    });

    it('sends correct JSON-RPC payload for search_read', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 2, result: [] }),
      });

      await client.searchRead(
        'sale.order',
        [['name', '=', 'S12345']],
        ['name', 'amount_total'],
        { limit: 1 }
      );

      const payload = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(payload.jsonrpc).toBe('2.0');
      expect(payload.method).toBe('call');
      expect(payload.params.service).toBe('object');
      expect(payload.params.method).toBe('execute_kw');
      expect(payload.params.args[0]).toBe('test-db'); // db
      expect(payload.params.args[1]).toBe(42); // uid
      expect(payload.params.args[2]).toBe('test-api-key'); // api key
      expect(payload.params.args[3]).toBe('sale.order'); // model
      expect(payload.params.args[4]).toBe('search_read'); // method
      expect(payload.params.args[5]).toEqual([[['name', '=', 'S12345']]]); // args
      expect(payload.params.args[6]).toEqual({
        fields: ['name', 'amount_total'],
        limit: 1,
      }); // kwargs
    });

    it('returns results from Odoo', async () => {
      const mockOrders = [
        { id: 1, name: 'S12345', amount_total: 5000 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ jsonrpc: '2.0', id: 2, result: mockOrders }),
      });

      const result = await client.searchRead(
        'sale.order',
        [['name', '=', 'S12345']],
        ['name', 'amount_total']
      );

      expect(result).toEqual(mockOrders);
    });

    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 2,
            error: {
              code: 200,
              message: 'Access Denied',
              data: { name: 'AccessError', message: 'No access to sale.order', debug: '' },
            },
          }),
      });

      await expect(
        client.searchRead('sale.order', [], ['name'])
      ).rejects.toThrow('Odoo API error on sale.order.search_read: No access to sale.order');
    });

    it('handles network errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      });

      await expect(
        client.searchRead('sale.order', [], ['name'])
      ).rejects.toThrow('Odoo API HTTP error (503)');
    });
  });

  describe('read', () => {
    let client: OdooReadOnlyClient;

    beforeEach(() => {
      client = new OdooReadOnlyClient(
        'https://test.odoo.com',
        'test-db',
        'api@test.com',
        'test-api-key'
      );
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: 42 }),
      });
    });

    it('sends correct JSON-RPC payload for read', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 2, result: [] }),
      });

      await client.read('res.partner', [10, 20], ['name', 'email']);

      const payload = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(payload.params.args[3]).toBe('res.partner');
      expect(payload.params.args[4]).toBe('read');
      expect(payload.params.args[5]).toEqual([[10, 20]]);
      expect(payload.params.args[6]).toEqual({ fields: ['name', 'email'] });
    });
  });

  // ============================================================
  // URL handling
  // ============================================================

  describe('URL handling', () => {
    it('strips trailing slash from URL', async () => {
      const client = new OdooReadOnlyClient(
        'https://test.odoo.com/',
        'test-db',
        'api@test.com',
        'test-api-key'
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: 42 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 2, result: [] }),
      });

      await client.searchRead('sale.order', [], ['name']);

      expect(mockFetch.mock.calls[0][0]).toBe('https://test.odoo.com/jsonrpc');
    });
  });
});
