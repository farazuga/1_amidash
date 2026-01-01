'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { SharePointGlobalConfig } from '@/types';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';

// Note: app_settings may not be in generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

// ============================================================================
// Types
// ============================================================================

export interface SaveSharePointConfigData {
  siteId: string;
  siteName: string;
  driveId: string;
  driveName: string;
  baseFolderId: string;
  baseFolderPath: string;
  baseFolderUrl: string;
}

export interface SaveSharePointConfigResult {
  success: boolean;
  config?: SharePointGlobalConfig;
  error?: string;
}

export interface GetSharePointConfigResult {
  success: boolean;
  config?: SharePointGlobalConfig | null;
  error?: string;
}

export interface RemoveSharePointConfigResult {
  success: boolean;
  error?: string;
}

export interface CheckMicrosoftConnectionResult {
  connected: boolean;
  email?: string;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createServiceClient() as AnySupabaseClient;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return data?.role === 'admin';
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get the current global SharePoint configuration
 */
export async function getSharePointConfig(): Promise<GetSharePointConfigResult> {
  try {
    const supabase = await createClient() as AnySupabaseClient;

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sharepoint_config')
      .maybeSingle();

    if (error) {
      console.error('[SharePoint Config] Error fetching config:', error);
      return { success: false, error: error.message };
    }

    if (!data || !data.value) {
      return { success: true, config: null };
    }

    return { success: true, config: data.value as SharePointGlobalConfig };
  } catch (error) {
    console.error('[SharePoint Config] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get SharePoint config',
    };
  }
}

/**
 * Save the global SharePoint configuration (admin only)
 */
export async function saveSharePointConfig(
  data: SaveSharePointConfigData
): Promise<SaveSharePointConfigResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Verify admin role
    if (!(await isAdmin(user.id))) {
      return { success: false, error: 'Admin access required' };
    }

    const config: SharePointGlobalConfig = {
      site_id: data.siteId,
      site_name: data.siteName,
      drive_id: data.driveId,
      drive_name: data.driveName,
      base_folder_id: data.baseFolderId,
      base_folder_path: data.baseFolderPath,
      base_folder_url: data.baseFolderUrl,
      configured_by: user.id,
      configured_at: new Date().toISOString(),
    };

    const supabase = await createServiceClient() as AnySupabaseClient;

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: 'sharepoint_config',
          value: config,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('[SharePoint Config] Error saving config:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/settings');
    revalidatePath('/', 'layout'); // Revalidate all pages that might check config

    return { success: true, config };
  } catch (error) {
    console.error('[SharePoint Config] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save SharePoint config',
    };
  }
}

/**
 * Remove the global SharePoint configuration (admin only)
 */
export async function removeSharePointConfig(): Promise<RemoveSharePointConfigResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Verify admin role
    if (!(await isAdmin(user.id))) {
      return { success: false, error: 'Admin access required' };
    }

    const supabase = await createServiceClient() as AnySupabaseClient;

    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('key', 'sharepoint_config');

    if (error) {
      console.error('[SharePoint Config] Error removing config:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/settings');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('[SharePoint Config] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove SharePoint config',
    };
  }
}

/**
 * Check if the current admin user has a Microsoft account connected
 */
export async function checkAdminMicrosoftConnection(): Promise<CheckMicrosoftConnectionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { connected: false, error: 'Authentication required' };
    }

    const supabase = await createServiceClient() as AnySupabaseClient;

    const { data, error } = await supabase
      .from('calendar_connections')
      .select('outlook_email')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (error) {
      console.error('[SharePoint Config] Error checking MS connection:', error);
      return { connected: false, error: error.message };
    }

    if (!data) {
      return { connected: false };
    }

    return { connected: true, email: data.outlook_email };
  } catch (error) {
    console.error('[SharePoint Config] Error:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Failed to check Microsoft connection',
    };
  }
}

/**
 * Get Microsoft connection for SharePoint API calls
 */
export async function getAdminMicrosoftConnection(): Promise<CalendarConnection | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createServiceClient() as AnySupabaseClient;

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'microsoft')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CalendarConnection;
}
