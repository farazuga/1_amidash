import { getSupabaseClient } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import type { PurchaseOrder } from '../../types/database.js';

/**
 * Fetch recent purchase orders (projects with po_number)
 */
export async function fetchRecentPOs(maxItems: number = 10): Promise<PurchaseOrder[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, client_name, po_number, sales_amount, created_at')
      .not('po_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(maxItems);

    if (error) {
      logger.error({ error }, 'Failed to fetch recent POs');
      throw error;
    }

    // Transform to PurchaseOrder type
    const pos: PurchaseOrder[] = (data || []).map((row) => ({
      id: row.id,
      client_name: row.client_name,
      po_number: row.po_number!,
      sales_amount: row.sales_amount,
      created_at: row.created_at,
    }));

    logger.info({ count: pos.length }, 'Fetched recent POs');
    return pos;
  } catch (error) {
    logger.error({ error }, 'Exception fetching recent POs');
    throw error;
  }
}

/**
 * Fetch POs created within a specific date range
 */
export async function fetchPOsInRange(
  startDate: string,
  endDate: string,
  maxItems: number = 20
): Promise<PurchaseOrder[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, client_name, po_number, sales_amount, created_at')
      .not('po_number', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(maxItems);

    if (error) {
      logger.error({ error, startDate, endDate }, 'Failed to fetch POs in range');
      throw error;
    }

    const pos: PurchaseOrder[] = (data || []).map((row) => ({
      id: row.id,
      client_name: row.client_name,
      po_number: row.po_number!,
      sales_amount: row.sales_amount,
      created_at: row.created_at,
    }));

    logger.info({ count: pos.length, startDate, endDate }, 'Fetched POs in range');
    return pos;
  } catch (error) {
    logger.error({ error }, 'Exception fetching POs in range');
    throw error;
  }
}

/**
 * Get total PO value for a time period
 */
export async function getPOTotals(
  startDate: string,
  endDate: string
): Promise<{ count: number; totalValue: number }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('sales_amount')
      .not('po_number', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      logger.error({ error }, 'Failed to get PO totals');
      throw error;
    }

    const count = data?.length || 0;
    const totalValue = (data || []).reduce(
      (sum, row) => sum + (row.sales_amount || 0),
      0
    );

    return { count, totalValue };
  } catch (error) {
    logger.error({ error }, 'Exception getting PO totals');
    throw error;
  }
}
