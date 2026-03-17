'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const SIGNAGE_API_URL = process.env.SIGNAGE_API_URL || 'http://127.0.0.1:3001';

// ===== Types =====

export type BlockType = 'po-highlight' | 'projects-invoiced' | 'quick-stats' | 'rich-text' | 'picture';
export type BlockPosition = 'left' | 'right' | 'both';

export interface SignageBlock {
  id: string;
  block_type: BlockType;
  title: string;
  content: Record<string, unknown>;
  enabled: boolean;
  position: BlockPosition;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SignageSettings {
  id: string;
  rotation_interval_ms: number;
  updated_at: string;
}

export interface SignageStatus {
  isRunning: boolean;
  uptime: number;
  currentSlide: number;
  totalSlides: number;
  fps: number;
  frameCount: number;
  dataStale: boolean;
}

export interface SignageConfig {
  ndi: { name: string; frameRate: number };
  display: { width: number; height: number; backgroundColor: string; accentColor: string; fontFamily: string; logoPath?: string };
  polling: { projects: number; revenue: number; schedule: number; purchaseOrders: number };
  slides: Array<{ type: string; enabled: boolean; duration: number; title?: string; maxItems?: number; scrollSpeed?: number; daysToShow?: number }>;
  transitions: { type: string; duration: number };
  api: { port: number; host: string };
  staleData: { warningThresholdMs: number; indicatorPosition: string };
}

// ===== API Helper =====

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SIGNAGE_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'API request failed');
  }

  return res.json();
}

// ===== Engine Control =====

export async function getSignageStatus(): Promise<SignageStatus | null> {
  try {
    return await fetchAPI<SignageStatus>('/status');
  } catch (error) {
    console.error('Failed to get signage status:', error);
    return null;
  }
}

export async function getSignageConfig(): Promise<SignageConfig | null> {
  try {
    return await fetchAPI<SignageConfig>('/config');
  } catch (error) {
    console.error('Failed to get signage config:', error);
    return null;
  }
}

export async function startSignageEngine(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message: string }>('/control/start', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function stopSignageEngine(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message: string }>('/control/stop', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function restartSignageEngine(): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await fetchAPI<{ success: boolean; message: string }>('/control/restart', {
      method: 'POST',
    });
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ===== Untyped Supabase helper (until db:types regenerated) =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// ===== Block CRUD =====

export async function getBlocks(): Promise<SignageBlock[]> {
  const supabase: AnySupabase = await createClient();

  const { data, error } = await supabase
    .from('signage_blocks')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch blocks:', error);
    return [];
  }

  return (data || []) as SignageBlock[];
}

export async function createBlock(block: {
  block_type: BlockType;
  title: string;
  content?: Record<string, unknown>;
  position?: BlockPosition;
  enabled?: boolean;
}): Promise<SignageBlock | null> {
  const supabase: AnySupabase = await createClient();

  // Get the highest display_order
  const { data: existing } = await supabase
    .from('signage_blocks')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('signage_blocks')
    .insert({
      block_type: block.block_type,
      title: block.title,
      content: block.content ?? {},
      position: block.position ?? 'both',
      enabled: block.enabled ?? true,
      display_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create block:', error);
    return null;
  }

  revalidatePath('/admin/signage');
  return data as SignageBlock;
}

export async function updateBlock(
  id: string,
  updates: Partial<{
    title: string;
    content: Record<string, unknown>;
    enabled: boolean;
    position: BlockPosition;
    display_order: number;
  }>
): Promise<SignageBlock | null> {
  const supabase: AnySupabase = await createClient();

  const { data, error } = await supabase
    .from('signage_blocks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update block:', error);
    return null;
  }

  revalidatePath('/admin/signage');
  return data as SignageBlock;
}

export async function deleteBlock(id: string): Promise<boolean> {
  const supabase: AnySupabase = await createClient();

  const { error } = await supabase
    .from('signage_blocks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete block:', error);
    return false;
  }

  revalidatePath('/admin/signage');
  return true;
}

export async function reorderBlocks(blockIds: string[]): Promise<boolean> {
  const supabase: AnySupabase = await createClient();

  const results = await Promise.all(
    blockIds.map((id, i) =>
      supabase.from('signage_blocks').update({ display_order: i }).eq('id', id)
    )
  );

  const failed = results.find(r => r.error);
  if (failed) {
    console.error('Failed to reorder block:', failed.error);
    return false;
  }

  revalidatePath('/admin/signage');
  return true;
}

// ===== Settings =====

export async function getSignageSettings(): Promise<SignageSettings | null> {
  const supabase: AnySupabase = await createClient();

  const { data, error } = await supabase
    .from('signage_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Failed to fetch signage settings:', error);
    return null;
  }

  return data as SignageSettings;
}

export async function updateSignageSettings(settings: {
  rotation_interval_ms: number;
}): Promise<SignageSettings | null> {
  const supabase: AnySupabase = await createClient();

  // Get the existing settings row id
  const { data: existing } = await supabase
    .from('signage_settings')
    .select('id')
    .limit(1)
    .single();

  if (!existing) {
    console.error('No signage settings row found');
    return null;
  }

  const { data, error } = await supabase
    .from('signage_settings')
    .update({ rotation_interval_ms: settings.rotation_interval_ms })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update signage settings:', error);
    return null;
  }

  revalidatePath('/admin/signage');
  return data as SignageSettings;
}

// ===== Image Upload =====

export async function uploadSignageImage(formData: FormData): Promise<string | null> {
  const supabase: AnySupabase = await createClient();

  const file = formData.get('file') as File;
  if (!file) {
    console.error('No file provided');
    return null;
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('signage-images')
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('Failed to upload image:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('signage-images')
    .getPublicUrl(filename);

  return urlData?.publicUrl || null;
}
