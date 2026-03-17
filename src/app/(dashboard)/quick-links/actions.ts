'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { QuickLinkCategory, QuickLinkItem } from '@/types/quick-links';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================
// Validation schemas
// ============================================

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  parent_id: z.string().uuid().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sort_order: z.number().int().default(0),
});

const itemSchema = z.object({
  category_id: z.string().uuid('Category is required'),
  title: z.string().min(1, 'Title is required').max(200),
  url: z.string().url('Must be a valid URL'),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sort_order: z.number().int().default(0),
});

// ============================================
// Read actions
// ============================================

export async function getQuickLinkCategories(): Promise<ActionResult<QuickLinkCategory[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quick_link_categories')
    .select('*')
    .order('sort_order');

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as QuickLinkCategory[] };
}

export async function getQuickLinkItems(): Promise<ActionResult<QuickLinkItem[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quick_link_items')
    .select('*')
    .order('sort_order');

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as QuickLinkItem[] };
}

// ============================================
// Category CRUD (admin only — RLS enforced)
// ============================================

export async function createCategory(input: unknown): Promise<ActionResult<QuickLinkCategory>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quick_link_categories')
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath('/quick-links');
  return { success: true, data: data as QuickLinkCategory };
}

export async function updateCategory(id: string, input: unknown): Promise<ActionResult<QuickLinkCategory>> {
  const parsed = categorySchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quick_link_categories')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath('/quick-links');
  return { success: true, data: data as QuickLinkCategory };
}

export async function deleteCategory(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('quick_link_categories')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  revalidatePath('/quick-links');
  return { success: true, data: undefined };
}

// ============================================
// Item CRUD (admin only — RLS enforced)
// ============================================

export async function createItem(input: unknown): Promise<ActionResult<QuickLinkItem>> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quick_link_items')
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath('/quick-links');
  return { success: true, data: data as QuickLinkItem };
}

export async function updateItem(id: string, input: unknown): Promise<ActionResult<QuickLinkItem>> {
  const parsed = itemSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quick_link_items')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath('/quick-links');
  return { success: true, data: data as QuickLinkItem };
}

export async function deleteItem(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('quick_link_items')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  revalidatePath('/quick-links');
  return { success: true, data: undefined };
}
