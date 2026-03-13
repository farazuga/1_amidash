/**
 * Odoo Integration - Singleton Factory
 *
 * Follows the same pattern as src/lib/activecampaign.ts.
 * Provides a singleton OdooReadOnlyClient, configuration check,
 * and reset function for testing.
 */

import { OdooReadOnlyClient } from './client';

let clientInstance: OdooReadOnlyClient | null = null;

/**
 * Check if Odoo integration is configured via environment variables.
 * Returns false if any required variable is missing.
 * API routes should call this before attempting any Odoo operations.
 */
export function isOdooConfigured(): boolean {
  return !!(
    process.env.ODOO_URL &&
    process.env.ODOO_DB &&
    process.env.ODOO_USER_LOGIN &&
    process.env.ODOO_API_KEY
  );
}

/**
 * Get the singleton OdooReadOnlyClient instance.
 * Throws if required environment variables are not set.
 */
export function getOdooClient(): OdooReadOnlyClient {
  if (!clientInstance) {
    const url = process.env.ODOO_URL;
    const db = process.env.ODOO_DB;
    const login = process.env.ODOO_USER_LOGIN;
    const apiKey = process.env.ODOO_API_KEY;

    if (!url) throw new Error('ODOO_URL environment variable is not set');
    if (!db) throw new Error('ODOO_DB environment variable is not set');
    if (!login) throw new Error('ODOO_USER_LOGIN environment variable is not set');
    if (!apiKey) throw new Error('ODOO_API_KEY environment variable is not set');

    clientInstance = new OdooReadOnlyClient(url, db, login, apiKey);
  }

  return clientInstance;
}

/**
 * Reset the singleton client instance.
 * Used in tests to ensure clean state.
 */
export function resetOdooClient(): void {
  clientInstance = null;
}

export { OdooReadOnlyClient } from './client';
