'use server';

import { createClient } from '@/lib/supabase/server';

export interface ReceivedPOData {
  totalValue: number;
  count: number;
  projects: Array<{ id: string; sales_amount: number; created_date: string }>;
}

/**
 * Query projects table for POs received in a given month (YYYY-MM format).
 * Uses created_date (user-editable PO received date) as the date field.
 */
export async function getReceivedPOs(monthKey: string): Promise<ReceivedPOData> {
  try {
    const supabase = await createClient();
    const [year, month] = monthKey.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('projects')
      .select('id, sales_amount, created_date')
      .not('po_number', 'is', null)
      .gte('created_date', startDate)
      .lt('created_date', endDate);

    if (error || !data) {
      console.error('Failed to fetch received POs:', error);
      return { totalValue: 0, count: 0, projects: [] };
    }

    const totalValue = data.reduce((sum, p) => sum + (p.sales_amount || 0), 0);
    return { totalValue, count: data.length, projects: data as ReceivedPOData['projects'] };
  } catch (err) {
    console.error('getReceivedPOs error:', err);
    return { totalValue: 0, count: 0, projects: [] };
  }
}
