/**
 * Odoo 18 JSON-RPC Read-Only Client
 *
 * SAFETY: This client is READ-ONLY by design.
 * - Only `searchRead()` and `read()` are public methods.
 * - The private `call()` method validates against an allowlist of methods.
 * - No create/write/unlink methods exist on this class.
 * - The Odoo API user should also be configured with read-only access in Odoo.
 */

import type {
  OdooJsonRpcResponse,
  AllowedOdooMethod,
} from '@/types/odoo';
import { ALLOWED_ODOO_METHODS } from '@/types/odoo';

export class OdooReadOnlyClient {
  private url: string;
  private db: string;
  private login: string;
  private apiKey: string;
  private uid: number | null = null;
  private requestId = 0;

  constructor(url: string, db: string, login: string, apiKey: string) {
    // Strip trailing slash from URL
    this.url = url.replace(/\/+$/, '');
    this.db = db;
    this.login = login;
    this.apiKey = apiKey;
  }

  /**
   * Authenticate with Odoo and cache the user ID.
   * Called once, uid is reused for all subsequent calls.
   */
  private async authenticate(): Promise<number> {
    if (this.uid !== null) {
      return this.uid;
    }

    const payload = {
      jsonrpc: '2.0' as const,
      method: 'call' as const,
      id: ++this.requestId,
      params: {
        service: 'common',
        method: 'authenticate',
        args: [this.db, this.login, this.apiKey, {}],
      },
    };

    const response = await fetch(`${this.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Odoo authentication HTTP error (${response.status}): ${errorText}`);
    }

    const data: OdooJsonRpcResponse<number | false> = await response.json();

    if (data.error) {
      throw new Error(
        `Odoo authentication error: ${data.error.data?.message || data.error.message}`
      );
    }

    if (!data.result) {
      throw new Error('Odoo authentication failed: invalid credentials or API key');
    }

    this.uid = data.result;
    return this.uid;
  }

  /**
   * Execute an Odoo ORM method via JSON-RPC.
   *
   * SAFETY: Validates method against ALLOWED_ODOO_METHODS before making any
   * network request. Throws immediately if method is not in the allowlist.
   */
  private async call<T>(
    model: string,
    method: AllowedOdooMethod,
    args: unknown[],
    kwargs?: Record<string, unknown>
  ): Promise<T> {
    // Runtime safety check - block any non-read method
    if (!ALLOWED_ODOO_METHODS.includes(method)) {
      throw new Error(
        `[Odoo SAFETY] Method "${method}" is BLOCKED. Only read methods are allowed: ${ALLOWED_ODOO_METHODS.join(', ')}`
      );
    }

    const uid = await this.authenticate();

    console.log(`[Odoo READ-ONLY] ${method} on ${model}`, {
      domain: args[0] ?? '(none)',
    });

    const payload = {
      jsonrpc: '2.0' as const,
      method: 'call' as const,
      id: ++this.requestId,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [this.db, uid, this.apiKey, model, method, args, kwargs || {}],
      },
    };

    const response = await fetch(`${this.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Odoo API HTTP error (${response.status}): ${errorText}`);
    }

    const data: OdooJsonRpcResponse<T> = await response.json();

    if (data.error) {
      throw new Error(
        `Odoo API error on ${model}.${method}: ${data.error.data?.message || data.error.message}`
      );
    }

    return data.result as T;
  }

  // ============================================================
  // PUBLIC READ-ONLY METHODS - These are the ONLY public methods
  // ============================================================

  /**
   * Search and read records from an Odoo model.
   * Combines search + read in a single call.
   */
  async searchRead<T>(
    model: string,
    domain: unknown[][],
    fields: string[],
    options?: { limit?: number; offset?: number; order?: string }
  ): Promise<T[]> {
    return this.call<T[]>(model, 'search_read', [domain], {
      fields,
      ...(options?.limit !== undefined && { limit: options.limit }),
      ...(options?.offset !== undefined && { offset: options.offset }),
      ...(options?.order !== undefined && { order: options.order }),
    });
  }

  /**
   * Read specific records by their IDs from an Odoo model.
   */
  async read<T>(
    model: string,
    ids: number[],
    fields: string[]
  ): Promise<T[]> {
    return this.call<T[]>(model, 'read', [ids], { fields });
  }
}
