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

// ============================================================================
// Bulk Folder Creation
// ============================================================================

export interface CreateMissingFoldersResult {
  success: boolean;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  errorDetails?: string[];
  error?: string;
}

/**
 * Create SharePoint folders for all projects that don't have one
 * (Admin only)
 */
export async function createMissingSharePointFolders(): Promise<CreateMissingFoldersResult> {
  // Import dynamically to avoid circular dependencies
  const { generateProjectFolderName } = await import('@/lib/sharepoint/folder-operations');
  const sharepoint = await import('@/lib/sharepoint/client');
  const { decryptToken, isEncryptionConfigured } = await import('@/lib/crypto');

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, processed: 0, created: 0, skipped: 0, errors: 0, error: 'Authentication required' };
    }

    // Verify admin role
    if (!(await isAdmin(user.id))) {
      return { success: false, processed: 0, created: 0, skipped: 0, errors: 0, error: 'Admin access required' };
    }

    const supabase = await createServiceClient() as AnySupabaseClient;

    // Get global SharePoint config
    const { data: configData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sharepoint_config')
      .maybeSingle();

    if (!configData?.value) {
      return { success: false, processed: 0, created: 0, skipped: 0, errors: 0, error: 'SharePoint not configured' };
    }

    const globalConfig = configData.value as SharePointGlobalConfig;

    // Get admin's Microsoft connection
    const { data: msConnectionData } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (!msConnectionData) {
      return { success: false, processed: 0, created: 0, skipped: 0, errors: 0, error: 'Microsoft account not connected' };
    }

    // Decrypt tokens if needed
    const msConnection = { ...msConnectionData };
    if (isEncryptionConfigured()) {
      try {
        msConnection.access_token = decryptToken(msConnectionData.access_token);
        msConnection.refresh_token = decryptToken(msConnectionData.refresh_token);
      } catch {
        // Use raw tokens if decryption fails
      }
    }

    // Get all projects with sales_order_number
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, client_name, sales_order_number')
      .not('sales_order_number', 'is', null);

    // Get projects that already have SharePoint connections
    const { data: existingConnections } = await supabase
      .from('project_sharepoint_connections')
      .select('project_id');

    const connectedProjectIds = new Set(
      existingConnections?.map((c: { project_id: string }) => c.project_id) || []
    );

    // Filter to projects without connections
    const projectsWithoutFolders = (allProjects || []).filter(
      (p: { id: string; sales_order_number: string | null }) =>
        p.sales_order_number && !connectedProjectIds.has(p.id)
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const project of projectsWithoutFolders) {
      try {
        const folderName = generateProjectFolderName(project.sales_order_number, project.client_name);

        // Create project folder
        const projectFolder = await sharepoint.createFolder(
          msConnection as CalendarConnection,
          globalConfig.drive_id,
          globalConfig.base_folder_id,
          folderName
        );

        // Create category subfolders
        const categories = ['schematics', 'sow', 'media', 'other'] as const;
        for (const category of categories) {
          const categoryFolderName = sharepoint.getCategoryFolderName(category);
          try {
            await sharepoint.createFolder(
              msConnection as CalendarConnection,
              globalConfig.drive_id,
              projectFolder.id,
              categoryFolderName
            );
          } catch {
            // Folder may already exist
          }
        }

        // Save connection to database
        const folderPath = globalConfig.base_folder_path === '/' || globalConfig.base_folder_path === 'Root'
          ? `/${folderName}`
          : `${globalConfig.base_folder_path}/${folderName}`;

        await supabase
          .from('project_sharepoint_connections')
          .insert({
            project_id: project.id,
            site_id: globalConfig.site_id,
            drive_id: globalConfig.drive_id,
            folder_id: projectFolder.id,
            folder_path: folderPath,
            folder_url: projectFolder.webUrl,
            connected_by: user.id,
            auto_created: true,
          });

        created++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        errors++;
        const errorMsg = `${project.sales_order_number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorDetails.push(errorMsg);
        console.error(`[CreateMissingFolders] Error for ${project.sales_order_number}:`, error);
      }
    }

    skipped = connectedProjectIds.size;

    return {
      success: true,
      processed: projectsWithoutFolders.length,
      created,
      skipped,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined,
    };

  } catch (error) {
    console.error('[CreateMissingFolders] Fatal error:', error);
    return {
      success: false,
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      error: error instanceof Error ? error.message : 'Failed to create folders',
    };
  }
}

/**
 * Get count of projects without SharePoint folders
 */
export async function getProjectsWithoutFoldersCount(): Promise<{ count: number; total: number }> {
  try {
    const supabase = await createServiceClient() as AnySupabaseClient;

    // Get all projects with sales_order_number
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id')
      .not('sales_order_number', 'is', null);

    // Get projects that already have SharePoint connections
    const { data: existingConnections } = await supabase
      .from('project_sharepoint_connections')
      .select('project_id');

    const connectedProjectIds = new Set(
      existingConnections?.map((c: { project_id: string }) => c.project_id) || []
    );

    const total = allProjects?.length || 0;
    const withoutFolders = (allProjects || []).filter(
      (p: { id: string }) => !connectedProjectIds.has(p.id)
    ).length;

    return { count: withoutFolders, total };
  } catch {
    return { count: 0, total: 0 };
  }
}

// ============================================================================
// Archive Invoiced Projects
// ============================================================================

export interface ArchiveInvoicedProjectsResult {
  success: boolean;
  processed: number;
  archived: number;
  skipped: number;
  errors: number;
  errorDetails?: string[];
  error?: string;
}

/**
 * Get count of invoiced projects that have SharePoint folders (ready for archiving)
 */
export async function getInvoicedProjectsWithFoldersCount(): Promise<{ count: number }> {
  try {
    const supabase = await createServiceClient() as AnySupabaseClient;

    // Get the Invoiced status ID
    const { data: invoicedStatus } = await supabase
      .from('statuses')
      .select('id')
      .eq('name', 'Invoiced')
      .single();

    if (!invoicedStatus) {
      return { count: 0 };
    }

    // Get invoiced projects with SharePoint connections that are not already archived
    const { data: projects, count } = await supabase
      .from('projects')
      .select(`
        id,
        project_sharepoint_connections!inner(id, folder_path)
      `, { count: 'exact' })
      .eq('current_status_id', invoicedStatus.id)
      .not('project_sharepoint_connections.folder_path', 'like', '%/_archive/%');

    return { count: count || projects?.length || 0 };
  } catch {
    return { count: 0 };
  }
}

/**
 * Archive all invoiced projects by moving their SharePoint folders to _archive/{year}
 * (Admin only)
 */
export async function archiveInvoicedProjects(): Promise<ArchiveInvoicedProjectsResult> {
  const sharepoint = await import('@/lib/sharepoint/client');
  const { decryptToken, isEncryptionConfigured } = await import('@/lib/crypto');

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, processed: 0, archived: 0, skipped: 0, errors: 0, error: 'Authentication required' };
    }

    // Verify admin role
    if (!(await isAdmin(user.id))) {
      return { success: false, processed: 0, archived: 0, skipped: 0, errors: 0, error: 'Admin access required' };
    }

    const supabase = await createServiceClient() as AnySupabaseClient;

    // Get global SharePoint config
    const { data: configData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'sharepoint_config')
      .maybeSingle();

    if (!configData?.value) {
      return { success: false, processed: 0, archived: 0, skipped: 0, errors: 0, error: 'SharePoint not configured' };
    }

    const globalConfig = configData.value as SharePointGlobalConfig;

    // Get admin's Microsoft connection
    const { data: msConnectionData } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (!msConnectionData) {
      return { success: false, processed: 0, archived: 0, skipped: 0, errors: 0, error: 'Microsoft account not connected' };
    }

    // Decrypt tokens if needed
    const msConnection = { ...msConnectionData };
    if (isEncryptionConfigured()) {
      try {
        msConnection.access_token = decryptToken(msConnectionData.access_token);
        msConnection.refresh_token = decryptToken(msConnectionData.refresh_token);
      } catch {
        // Use raw tokens if decryption fails
      }
    }

    // Get the Invoiced status ID
    const { data: invoicedStatus } = await supabase
      .from('statuses')
      .select('id')
      .eq('name', 'Invoiced')
      .single();

    if (!invoicedStatus) {
      return { success: false, processed: 0, archived: 0, skipped: 0, errors: 0, error: 'Invoiced status not found' };
    }

    // Get invoiced projects with SharePoint connections that are not already archived
    // Use !inner join to only get projects that have a SharePoint connection
    const { data: projectsToArchive } = await supabase
      .from('projects')
      .select(`
        id,
        sales_order_number,
        client_name,
        invoiced_date,
        project_sharepoint_connections!inner(id, drive_id, folder_id, folder_path, folder_url)
      `)
      .eq('current_status_id', invoicedStatus.id)
      .not('project_sharepoint_connections.folder_path', 'like', '%/_archive/%');

    if (!projectsToArchive || projectsToArchive.length === 0) {
      return { success: true, processed: 0, archived: 0, skipped: 0, errors: 0 };
    }

    // projectsToArchive already only contains projects with SharePoint connections due to !inner join
    const projectsWithFolders = projectsToArchive;

    let archived = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Cache for year folders to avoid creating duplicates
    const yearFolderCache = new Map<number, { yearFolderId: string; yearFolderPath: string }>();

    for (const project of projectsWithFolders) {
      try {
        const connection = project.project_sharepoint_connections[0];

        // Skip if already in archive folder
        if (connection.folder_path?.includes('/_archive/')) {
          skipped++;
          continue;
        }

        // Determine the year (use invoiced_date year or current year)
        const year = project.invoiced_date
          ? new Date(project.invoiced_date).getFullYear()
          : new Date().getFullYear();

        // Get or create the archive year folder (use cache)
        let yearFolderInfo = yearFolderCache.get(year);
        if (!yearFolderInfo) {
          const result = await sharepoint.getOrCreateArchiveFolder(
            msConnection as CalendarConnection,
            globalConfig.drive_id,
            globalConfig.base_folder_id,
            globalConfig.base_folder_path,
            year
          );
          yearFolderInfo = { yearFolderId: result.yearFolderId, yearFolderPath: result.yearFolderPath };
          yearFolderCache.set(year, yearFolderInfo);
        }

        // Move the project folder to the archive year folder
        const movedItem = await sharepoint.moveItem(
          msConnection as CalendarConnection,
          connection.drive_id,
          connection.folder_id,
          yearFolderInfo.yearFolderId
        );

        // Extract folder name from original path
        const folderName = connection.folder_path?.split('/').pop() || '';
        const newFolderPath = `${yearFolderInfo.yearFolderPath}/${folderName}`;

        // Update the database record with new path and URL
        await supabase
          .from('project_sharepoint_connections')
          .update({
            folder_path: newFolderPath,
            folder_url: movedItem.webUrl,
          })
          .eq('id', connection.id);

        archived++;

        // Rate limiting to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        errors++;
        const errorMsg = `${project.sales_order_number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorDetails.push(errorMsg);
        console.error(`[ArchiveInvoicedProjects] Error for ${project.sales_order_number}:`, error);
      }
    }

    // Count skipped as projects that were already in archive
    const alreadyArchived = projectsToArchive.length - projectsWithFolders.length;
    skipped += alreadyArchived;

    return {
      success: true,
      processed: projectsWithFolders.length,
      archived,
      skipped,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined,
    };

  } catch (error) {
    console.error('[ArchiveInvoicedProjects] Fatal error:', error);
    return {
      success: false,
      processed: 0,
      archived: 0,
      skipped: 0,
      errors: 0,
      error: error instanceof Error ? error.message : 'Failed to archive projects',
    };
  }
}
