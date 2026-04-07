'use server';

import { createClient } from '@/lib/supabase/server';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getPresalesFileCounts(
  dealIds: string[]
): Promise<ActionResult<Record<string, number>>> {
  if (!dealIds.length) {
    return { success: true, data: {} };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('presales_files')
    .select('activecampaign_deal_id')
    .in('activecampaign_deal_id', dealIds);

  if (error) {
    return { success: false, error: error.message };
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    const id = row.activecampaign_deal_id;
    counts[id] = (counts[id] || 0) + 1;
  }

  return { success: true, data: counts };
}

export async function getPresalesFiles(
  dealId: string
): Promise<ActionResult<any[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('presales_files')
    .select(
      'id, file_name, category, web_url, thumbnail_url, local_thumbnail_url, notes, created_at, upload_status, file_size'
    )
    .eq('activecampaign_deal_id', dealId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data ?? [] };
}
