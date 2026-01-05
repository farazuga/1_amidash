'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import * as sharepoint from '@/lib/sharepoint/client';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';
import type {
  ProjectFile,
  PresalesFile,
  ProjectSharePointConnection,
  FileCategory,
  ProjectPhase,
  FileCategoryCount,
  SharePointGlobalConfig,
} from '@/types';

// Note: The new tables (project_sharepoint_connections, project_files, presales_files)
// may not be in the generated Supabase types yet. We use type assertions to work around this.
// Run `npx supabase gen types typescript` after migration to regenerate types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

// ============================================================================
// Types
// ============================================================================

export interface ConnectSharePointData {
  projectId: string;
  siteId: string;
  driveId: string;
  folderId: string;
  folderPath: string;
  folderUrl: string;
  createSubfolders?: boolean;
}

export interface ConnectSharePointResult {
  success: boolean;
  connection?: ProjectSharePointConnection;
  error?: string;
}

export interface UploadFileData {
  projectId: string;
  fileName: string;
  fileContent: ArrayBuffer;
  contentType: string;
  category: FileCategory;
  notes?: string;
  capturedOffline?: boolean;
  capturedOnDevice?: string;
}

export interface UploadFileResult {
  success: boolean;
  file?: ProjectFile;
  error?: string;
}

export interface GetFilesResult {
  success: boolean;
  files?: ProjectFile[];
  counts?: FileCategoryCount[];
  connection?: ProjectSharePointConnection | null;
  globalSharePointConfigured?: boolean;
  error?: string;
}

export interface SyncFilesResult {
  success: boolean;
  syncedCount?: number;
  error?: string;
}

export interface DeleteFileResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getMicrosoftConnection(userId: string): Promise<CalendarConnection | null> {
  const supabase = await createServiceClient();

  // Use type assertion since calendar_connections may not be in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CalendarConnection;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

// Helper to get typed client for new tables
async function getTypedClient(): Promise<AnySupabaseClient> {
  return await createClient() as AnySupabaseClient;
}

async function getTypedServiceClient(): Promise<AnySupabaseClient> {
  return await createServiceClient() as AnySupabaseClient;
}

/**
 * Get the global SharePoint configuration
 */
async function getGlobalSharePointConfig(): Promise<SharePointGlobalConfig | null> {
  const db = await getTypedClient();
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'sharepoint_config')
    .maybeSingle();

  if (!data || !data.value) {
    return null;
  }

  return data.value as SharePointGlobalConfig;
}

/**
 * Check if global SharePoint is configured
 */
export async function isSharePointConfigured(): Promise<boolean> {
  const config = await getGlobalSharePointConfig();
  return config !== null;
}

/**
 * Ensure a project has a SharePoint folder (auto-create if needed)
 * Uses the global SharePoint configuration
 */
async function ensureProjectFolder(
  projectId: string,
  projectName: string,
  userId: string,
  msConnection: CalendarConnection
): Promise<{ success: boolean; connection?: ProjectSharePointConnection; error?: string }> {
  const db = await getTypedClient();

  // Check if project already has a connection
  const { data: existingConnection } = await db
    .from('project_sharepoint_connections')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (existingConnection) {
    return { success: true, connection: existingConnection as ProjectSharePointConnection };
  }

  // Get global SharePoint config
  const globalConfig = await getGlobalSharePointConfig();
  if (!globalConfig) {
    return { success: false, error: 'SharePoint not configured. Contact your administrator.' };
  }

  try {
    // Sanitize project name for folder name
    const folderName = projectName.replace(/[<>:"/\\|?*]/g, '-').trim();

    // Create project folder under the base folder
    const projectFolder = await sharepoint.createFolder(
      msConnection,
      globalConfig.drive_id,
      globalConfig.base_folder_id,
      folderName
    );

    // Create category subfolders
    const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];
    for (const category of categories) {
      const categoryFolderName = sharepoint.getCategoryFolderName(category);
      try {
        await sharepoint.createFolder(msConnection, globalConfig.drive_id, projectFolder.id, categoryFolderName);
      } catch {
        // Folder may already exist
        console.log(`Category folder ${categoryFolderName} may already exist`);
      }
    }

    // Save connection to database
    const folderPath = globalConfig.base_folder_path === '/' || globalConfig.base_folder_path === 'Root'
      ? `/${folderName}`
      : `${globalConfig.base_folder_path}/${folderName}`;

    const { data: connection, error: insertError } = await db
      .from('project_sharepoint_connections')
      .insert({
        project_id: projectId,
        site_id: globalConfig.site_id,
        drive_id: globalConfig.drive_id,
        folder_id: projectFolder.id,
        folder_path: folderPath,
        folder_url: projectFolder.webUrl,
        connected_by: userId,
        auto_created: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save auto-created SharePoint connection:', insertError);
      return { success: false, error: 'Failed to save connection' };
    }

    // Note: Skip revalidatePath here to avoid disrupting streaming responses
    // Client updates state optimistically, data refreshes on next navigation

    return { success: true, connection: connection as ProjectSharePointConnection };
  } catch (error) {
    console.error('Auto-create project folder error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project folder',
    };
  }
}

// ============================================================================
// SharePoint Connection Actions
// ============================================================================

/**
 * Connect a project to a SharePoint folder
 */
export async function connectSharePointFolder(
  data: ConnectSharePointData
): Promise<ConnectSharePointResult> {
  const supabase = await createClient();
  const db = await getTypedClient(); // For new tables

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get Microsoft connection for SharePoint API calls
  const msConnection = await getMicrosoftConnection(user.id);
  if (!msConnection) {
    return { success: false, error: 'Please connect your Microsoft account first' };
  }

  try {
    let finalFolderId = data.folderId;
    let finalFolderPath = data.folderPath;
    let finalFolderUrl = data.folderUrl;

    // If folderId is 'new', create the folder
    if (data.folderId === 'new') {
      const folderName = data.folderPath.split('/').pop() || 'Project';
      const parentPath = data.folderPath.substring(0, data.folderPath.lastIndexOf('/'));

      // Get parent folder
      const parentFolder = await sharepoint.getItemByPath(msConnection, data.driveId, parentPath);
      if (!parentFolder) {
        return { success: false, error: 'Parent folder not found' };
      }

      // Create new folder
      const newFolder = await sharepoint.createFolder(
        msConnection,
        data.driveId,
        parentFolder.id,
        folderName
      );

      finalFolderId = newFolder.id;
      finalFolderUrl = newFolder.webUrl;
    }

    // Create category subfolders if requested
    if (data.createSubfolders !== false) {
      const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];
      for (const category of categories) {
        const folderName = sharepoint.getCategoryFolderName(category);
        try {
          await sharepoint.createFolder(msConnection, data.driveId, finalFolderId, folderName);
        } catch (err) {
          // Folder may already exist, that's OK
          console.log(`Category folder ${folderName} may already exist`);
        }
      }
    }

    // Save connection to database
    const { data: connection, error: insertError } = await db
      .from('project_sharepoint_connections')
      .insert({
        project_id: data.projectId,
        site_id: data.siteId,
        drive_id: data.driveId,
        folder_id: finalFolderId,
        folder_path: finalFolderPath,
        folder_url: finalFolderUrl,
        connected_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save SharePoint connection:', insertError);
      return { success: false, error: 'Failed to save connection' };
    }

    try {
      revalidatePath(`/projects/${data.projectId}`);
    } catch (e) {
      console.error('Revalidation error (non-fatal):', e);
    }

    return { success: true, connection: connection as ProjectSharePointConnection };
  } catch (error) {
    console.error('SharePoint connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect SharePoint',
    };
  }
}

/**
 * Disconnect a project from SharePoint (doesn't delete files)
 */
export async function disconnectSharePoint(projectId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { error } = await db
    .from('project_sharepoint_connections')
    .delete()
    .eq('project_id', projectId);

  if (error) {
    return { success: false, error: 'Failed to disconnect' };
  }

  try {
    revalidatePath(`/projects/${projectId}`);
  } catch (e) {
    console.error('Revalidation error (non-fatal):', e);
  }
  return { success: true };
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Get all files for a project with counts and connection info
 */
export async function getProjectFiles(projectId: string): Promise<GetFilesResult> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get connection
  const { data: connection } = await db
    .from('project_sharepoint_connections')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  // Check if global SharePoint is configured
  const globalConfig = await getGlobalSharePointConfig();

  // Get files
  const { data: files, error: filesError } = await db
    .from('project_files')
    .select(`
      *,
      uploaded_by_profile:profiles!project_files_uploaded_by_fkey(id, email, full_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filesError) {
    console.error('Failed to get files:', filesError);
    return { success: false, error: 'Failed to load files' };
  }

  // Get counts by category
  const { data: countsData } = await db.rpc('get_project_file_counts', {
    p_project_id: projectId,
  });

  const counts: FileCategoryCount[] = countsData || [];

  return {
    success: true,
    files: (files || []) as ProjectFile[],
    counts,
    connection: connection as ProjectSharePointConnection | null,
    globalSharePointConfigured: globalConfig !== null,
  };
}

/**
 * Upload a file to SharePoint and track in database
 */
export async function uploadFile(data: UploadFileData): Promise<UploadFileResult> {
  console.log('[uploadFile] === STEP 1: Starting upload ===');
  console.log('[uploadFile] Input:', {
    projectId: data.projectId,
    fileName: data.fileName,
    contentType: data.contentType,
    category: data.category,
    fileSize: data.fileContent.byteLength,
  });

  let supabase;
  let db;
  try {
    console.log('[uploadFile] === STEP 2: Creating Supabase clients ===');
    supabase = await createClient();
    db = await getTypedClient();
    console.log('[uploadFile] Clients created successfully');
  } catch (clientError) {
    console.error('[uploadFile] Failed to create Supabase client:', clientError);
    return { success: false, error: `Database connection failed: ${clientError instanceof Error ? clientError.message : 'Unknown error'}` };
  }

  let user;
  try {
    console.log('[uploadFile] === STEP 3: Getting user ===');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('[uploadFile] Auth error:', userError);
      return { success: false, error: 'Authentication required' };
    }
    user = userData.user;
    console.log('[uploadFile] User authenticated:', user.id);
  } catch (authError) {
    console.error('[uploadFile] Auth exception:', authError);
    return { success: false, error: `Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}` };
  }

  // Get Microsoft connection first
  let msConnection;
  try {
    console.log('[uploadFile] === STEP 4: Getting Microsoft connection ===');
    msConnection = await getMicrosoftConnection(user.id);
    if (!msConnection) {
      console.error('[uploadFile] No Microsoft connection for user:', user.id);
      return { success: false, error: 'Please connect your Microsoft account' };
    }
    console.log('[uploadFile] Microsoft connection found');
  } catch (msError) {
    console.error('[uploadFile] Microsoft connection error:', msError);
    return { success: false, error: `Microsoft connection failed: ${msError instanceof Error ? msError.message : 'Unknown error'}` };
  }

  // Get project name for folder creation
  let project;
  try {
    console.log('[uploadFile] === STEP 5: Getting project ===');
    const { data: projectData, error: projectError } = await db
      .from('projects')
      .select('client_name')
      .eq('id', data.projectId)
      .single();

    if (projectError || !projectData) {
      console.error('[uploadFile] Project not found:', projectError);
      return { success: false, error: 'Project not found' };
    }
    project = projectData;
    console.log('[uploadFile] Project found:', project.client_name);
  } catch (projectFetchError) {
    console.error('[uploadFile] Project fetch exception:', projectFetchError);
    return { success: false, error: `Failed to fetch project: ${projectFetchError instanceof Error ? projectFetchError.message : 'Unknown error'}` };
  }

  // Ensure project has a SharePoint folder (auto-create if needed)
  let connection;
  try {
    console.log('[uploadFile] === STEP 6: Ensuring project folder ===');
    const folderResult = await ensureProjectFolder(
      data.projectId,
      project.client_name,
      user.id,
      msConnection
    );

    if (!folderResult.success || !folderResult.connection) {
      console.error('[uploadFile] Folder setup failed:', folderResult.error);
      return { success: false, error: folderResult.error || 'Failed to setup project folder' };
    }
    connection = folderResult.connection;
    console.log('[uploadFile] Project folder ready:', connection.folder_path);
  } catch (folderError) {
    console.error('[uploadFile] Folder setup exception:', folderError);
    return { success: false, error: `Folder setup failed: ${folderError instanceof Error ? folderError.message : 'Unknown error'}` };
  }

  try {
    // Get the category subfolder
    console.log('[uploadFile] === STEP 7: Getting category folder ===');
    const categoryFolderName = sharepoint.getCategoryFolderName(data.category);
    console.log('[uploadFile] Category folder name:', categoryFolderName);

    let categoryFolder;
    try {
      categoryFolder = await sharepoint.getItemByPath(
        msConnection,
        connection.drive_id,
        `${connection.folder_path}/${categoryFolderName}`
      );
      console.log('[uploadFile] Category folder found:', categoryFolder?.id);
    } catch (catFolderError) {
      console.log('[uploadFile] Category folder not found, will create it');
    }

    if (!categoryFolder) {
      // Create category folder if it doesn't exist
      console.log('[uploadFile] Creating category folder...');
      const rootFolder = await sharepoint.getItem(msConnection, connection.drive_id, connection.folder_id);
      await sharepoint.createFolder(msConnection, connection.drive_id, rootFolder.id, categoryFolderName);
      console.log('[uploadFile] Category folder created');
    }

    const targetFolderId = categoryFolder?.id || connection.folder_id;

    // Upload to SharePoint
    console.log('[uploadFile] === STEP 8: Uploading to SharePoint ===');
    console.log('[uploadFile] Upload params:', {
      driveId: connection.drive_id,
      folderId: targetFolderId,
      fileName: data.fileName,
      blobSize: data.fileContent.byteLength,
    });

    const blob = new Blob([data.fileContent], { type: data.contentType });
    const uploadResult = await sharepoint.uploadFile(
      msConnection,
      connection.drive_id,
      targetFolderId,
      data.fileName,
      blob,
      data.contentType
    );

    console.log('[uploadFile] SharePoint upload result:', {
      success: uploadResult.success,
      error: uploadResult.error,
      itemId: uploadResult.item?.id,
    });

    if (!uploadResult.success || !uploadResult.item) {
      console.error('[uploadFile] SharePoint upload failed:', uploadResult.error);
      return { success: false, error: uploadResult.error || 'Upload failed' };
    }

    const spItem = uploadResult.item;
    console.log('[uploadFile] === STEP 9: SharePoint upload complete ===');

    // Get thumbnail if available
    console.log('[uploadFile] === STEP 10: Getting thumbnail ===');
    let thumbnailUrl: string | null = null;
    if (spItem.file?.mimeType?.startsWith('image/') || spItem.file?.mimeType?.startsWith('video/')) {
      try {
        const thumbnails = await sharepoint.getThumbnails(msConnection, connection.drive_id, spItem.id);
        thumbnailUrl = thumbnails?.[0]?.medium?.url || thumbnails?.[0]?.small?.url || null;
        console.log('[uploadFile] Thumbnail URL:', thumbnailUrl ? 'obtained' : 'not available');
      } catch (thumbError) {
        console.log('[uploadFile] Thumbnail not available:', thumbError);
      }
    }

    // Save file record to database
    console.log('[uploadFile] === STEP 11: Saving to database ===');
    const insertPayload = {
      project_id: data.projectId,
      connection_id: connection.id,
      file_name: data.fileName,
      sharepoint_item_id: spItem.id,
      category: data.category,
      file_size: spItem.size,
      mime_type: spItem.file?.mimeType || data.contentType,
      file_extension: getFileExtension(data.fileName),
      web_url: spItem.webUrl,
      download_url: spItem['@microsoft.graph.downloadUrl'],
      thumbnail_url: thumbnailUrl,
      uploaded_by: user.id,
      sharepoint_modified_by: spItem.lastModifiedBy?.user?.email,
      sharepoint_modified_at: spItem.lastModifiedDateTime,
      notes: data.notes,
      upload_status: 'uploaded',
      is_synced: true,
      captured_on_device: data.capturedOnDevice,
      captured_offline: data.capturedOffline || false,
    };
    console.log('[uploadFile] Insert payload:', {
      ...insertPayload,
      download_url: insertPayload.download_url ? '[redacted]' : null,
    });

    const { data: file, error: insertError } = await db
      .from('project_files')
      .insert(insertPayload)
      .select(`
        *,
        uploaded_by_profile:profiles!project_files_uploaded_by_fkey(id, email, full_name)
      `)
      .single();

    if (insertError) {
      console.error('[uploadFile] Database insert error:', insertError);
      console.error('[uploadFile] Insert error details:', JSON.stringify(insertError, null, 2));
      return { success: false, error: `Database error: ${insertError.message || 'Failed to save record'}` };
    }

    console.log('[uploadFile] === STEP 12: Upload complete ===');
    console.log('[uploadFile] File saved with ID:', file?.id);

    // Note: We skip revalidatePath here because:
    // 1. Client already updates state optimistically
    // 2. revalidatePath can disrupt streaming responses in production
    // 3. Page will refresh data on next navigation anyway

    return { success: true, file: file as ProjectFile };
  } catch (error) {
    console.error('[uploadFile] Unexpected error:', error);
    console.error('[uploadFile] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Sync files from SharePoint to database
 * Fetches all files in the project folder and updates local records
 */
export async function syncFilesFromSharePoint(projectId: string): Promise<SyncFilesResult> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get SharePoint connection
  const { data: connection } = await db
    .from('project_sharepoint_connections')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (!connection) {
    return { success: false, error: 'Project is not connected to SharePoint' };
  }

  const msConnection = await getMicrosoftConnection(user.id);
  if (!msConnection) {
    return { success: false, error: 'Please connect your Microsoft account' };
  }

  try {
    let syncedCount = 0;
    const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];

    for (const category of categories) {
      const folderName = sharepoint.getCategoryFolderName(category);

      try {
        const items = await sharepoint.listFolderContentsByPath(
          msConnection,
          connection.drive_id,
          `${connection.folder_path}/${folderName}`
        );

        for (const item of items) {
          // Skip folders
          if (item.folder) continue;

          // Check if file already exists in database
          const { data: existing } = await db
            .from('project_files')
            .select('id, sharepoint_modified_at')
            .eq('sharepoint_item_id', item.id)
            .maybeSingle();

          // Get thumbnail
          let thumbnailUrl: string | null = null;
          if (item.file?.mimeType?.startsWith('image/') || item.file?.mimeType?.startsWith('video/')) {
            try {
              const thumbnails = await sharepoint.getThumbnails(msConnection, connection.drive_id, item.id);
              thumbnailUrl = thumbnails?.[0]?.medium?.url || thumbnails?.[0]?.small?.url || null;
            } catch {
              // Thumbnails not available
            }
          }

          if (existing) {
            // Update if modified
            if (existing.sharepoint_modified_at !== item.lastModifiedDateTime) {
              await db
                .from('project_files')
                .update({
                  file_name: item.name,
                  file_size: item.size,
                  web_url: item.webUrl,
                  download_url: item['@microsoft.graph.downloadUrl'],
                  thumbnail_url: thumbnailUrl,
                  sharepoint_modified_by: item.lastModifiedBy?.user?.email,
                  sharepoint_modified_at: item.lastModifiedDateTime,
                })
                .eq('id', existing.id);
              syncedCount++;
            }
          } else {
            // Insert new file
            await db
              .from('project_files')
              .insert({
                project_id: projectId,
                connection_id: connection.id,
                file_name: item.name,
                sharepoint_item_id: item.id,
                category,
                file_size: item.size,
                mime_type: item.file?.mimeType,
                file_extension: getFileExtension(item.name),
                web_url: item.webUrl,
                download_url: item['@microsoft.graph.downloadUrl'],
                thumbnail_url: thumbnailUrl,
                sharepoint_modified_by: item.lastModifiedBy?.user?.email,
                sharepoint_modified_at: item.lastModifiedDateTime,
                upload_status: 'uploaded',
                is_synced: true,
              });
            syncedCount++;
          }
        }
      } catch (err) {
        // Category folder may not exist, that's OK
        console.log(`Category folder ${folderName} not found or error:`, err);
      }
    }

    // Update last synced timestamp
    await db
      .from('project_sharepoint_connections')
      .update({ last_synced_at: new Date().toISOString(), sync_error: null })
      .eq('id', connection.id);

    try {
      revalidatePath(`/projects/${projectId}`);
    } catch (e) {
      console.error('Revalidation error (non-fatal):', e);
    }

    return { success: true, syncedCount };
  } catch (error) {
    console.error('Sync error:', error);

    // Update sync error
    await db
      .from('project_sharepoint_connections')
      .update({ sync_error: error instanceof Error ? error.message : 'Sync failed' })
      .eq('id', connection.id);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Delete a file from SharePoint and database
 */
export async function deleteFile(fileId: string): Promise<DeleteFileResult> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get file and connection
  const { data: file } = await db
    .from('project_files')
    .select(`
      *,
      connection:project_sharepoint_connections(*)
    `)
    .eq('id', fileId)
    .single();

  if (!file) {
    return { success: false, error: 'File not found' };
  }

  // Check permission (owner or admin)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (file.uploaded_by !== user.id && profile?.role !== 'admin') {
    return { success: false, error: 'Permission denied' };
  }

  try {
    // Delete from SharePoint if connected and has SharePoint ID
    if (file.sharepoint_item_id && file.connection) {
      const msConnection = await getMicrosoftConnection(user.id);
      if (msConnection) {
        try {
          await sharepoint.deleteItem(
            msConnection,
            file.connection.drive_id,
            file.sharepoint_item_id
          );
        } catch (err) {
          // File may already be deleted from SharePoint, continue with DB deletion
          console.log('SharePoint delete error (may already be deleted):', err);
        }
      }
    }

    // Delete from database
    const { error: deleteError } = await db
      .from('project_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      return { success: false, error: 'Failed to delete file record' };
    }

    try {
      revalidatePath(`/projects/${file.project_id}`);
    } catch (e) {
      console.error('Revalidation error (non-fatal):', e);
    }

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Get a fresh download URL for a file
 */
export async function getDownloadUrl(fileId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data: file } = await db
    .from('project_files')
    .select(`
      sharepoint_item_id,
      connection:project_sharepoint_connections(drive_id)
    `)
    .eq('id', fileId)
    .single();

  if (!file || !file.sharepoint_item_id || !file.connection) {
    return { success: false, error: 'File not found or not connected to SharePoint' };
  }

  const msConnection = await getMicrosoftConnection(user.id);
  if (!msConnection) {
    return { success: false, error: 'Please connect your Microsoft account' };
  }

  try {
    const url = await sharepoint.getDownloadUrl(
      msConnection,
      file.connection.drive_id,
      file.sharepoint_item_id
    );

    // Log access
    await db.from('project_file_access_logs').insert({
      file_id: fileId,
      user_id: user.id,
      action: 'download',
    });

    return { success: true, url };
  } catch (error) {
    console.error('Get download URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get download URL',
    };
  }
}

/**
 * Create a share link for a file
 */
export async function createShareLink(
  fileId: string,
  type: 'view' | 'edit' = 'view'
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data: file } = await db
    .from('project_files')
    .select(`
      sharepoint_item_id,
      connection:project_sharepoint_connections(drive_id)
    `)
    .eq('id', fileId)
    .single();

  if (!file || !file.sharepoint_item_id || !file.connection) {
    return { success: false, error: 'File not found or not connected to SharePoint' };
  }

  const msConnection = await getMicrosoftConnection(user.id);
  if (!msConnection) {
    return { success: false, error: 'Please connect your Microsoft account' };
  }

  try {
    const result = await sharepoint.createShareLink(
      msConnection,
      file.connection.drive_id,
      file.sharepoint_item_id,
      { type, scope: 'organization' }
    );

    // Log access
    await db.from('project_file_access_logs').insert({
      file_id: fileId,
      user_id: user.id,
      action: 'share',
    });

    return { success: true, url: result.link.webUrl };
  } catch (error) {
    console.error('Create share link error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create share link',
    };
  }
}

// ============================================================================
// Presales File Operations
// ============================================================================

/**
 * Upload a presales file (before project exists)
 */
export async function uploadPresalesFile(data: {
  dealId: string;
  dealName?: string;
  fileName: string;
  fileContent: ArrayBuffer;
  contentType: string;
  category: FileCategory;
  notes?: string;
  capturedOffline?: boolean;
  capturedOnDevice?: string;
}): Promise<{ success: boolean; file?: PresalesFile; error?: string }> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // For presales, we'll just store metadata now and upload to SharePoint when project is created
  // Or we could upload to a PreSales folder in SharePoint

  const msConnection = await getMicrosoftConnection(user.id);

  let sharepointItemId: string | null = null;
  let webUrl: string | null = null;
  let downloadUrl: string | null = null;
  let thumbnailUrl: string | null = null;

  // If we have SharePoint connection, upload to PreSales folder
  if (msConnection) {
    try {
      // This would require a configured PreSales site/drive
      // For now, we'll store locally and sync later
      // TODO: Implement presales SharePoint folder configuration
    } catch (error) {
      console.log('Presales SharePoint upload not configured, storing locally');
    }
  }

  const { data: file, error: insertError } = await db
    .from('presales_files')
    .insert({
      activecampaign_deal_id: data.dealId,
      activecampaign_deal_name: data.dealName,
      file_name: data.fileName,
      sharepoint_item_id: sharepointItemId,
      category: data.category,
      file_size: data.fileContent.byteLength,
      mime_type: data.contentType,
      file_extension: getFileExtension(data.fileName),
      web_url: webUrl,
      download_url: downloadUrl,
      thumbnail_url: thumbnailUrl,
      uploaded_by: user.id,
      upload_status: sharepointItemId ? 'uploaded' : 'pending',
      notes: data.notes,
      captured_on_device: data.capturedOnDevice,
      captured_offline: data.capturedOffline || false,
    })
    .select(`
      *,
      uploaded_by_profile:profiles!presales_files_uploaded_by_fkey(id, email, full_name)
    `)
    .single();

  if (insertError) {
    console.error('Failed to save presales file:', insertError);
    return { success: false, error: 'Failed to save file' };
  }

  return { success: true, file: file as PresalesFile };
}

/**
 * Get presales files for a deal
 */
export async function getPresalesFiles(dealId: string): Promise<{
  success: boolean;
  files?: PresalesFile[];
  counts?: FileCategoryCount[];
  error?: string;
}> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data: files, error: filesError } = await db
    .from('presales_files')
    .select(`
      *,
      uploaded_by_profile:profiles!presales_files_uploaded_by_fkey(id, email, full_name)
    `)
    .eq('activecampaign_deal_id', dealId)
    .order('created_at', { ascending: false });

  if (filesError) {
    return { success: false, error: 'Failed to load files' };
  }

  // Get counts
  const { data: countsData } = await db.rpc('get_presales_file_counts', {
    p_deal_id: dealId,
  });

  return {
    success: true,
    files: (files || []) as PresalesFile[],
    counts: countsData || [],
  };
}

/**
 * Link presales files to a project when PO is received
 */
export async function linkPresalesFilesToProject(
  dealId: string,
  projectId: string
): Promise<{ success: boolean; linkedCount?: number; error?: string }> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Use the database function to link files
    const { data, error } = await db.rpc('link_presales_files_to_project', {
      p_deal_id: dealId,
      p_project_id: projectId,
    });

    if (error) {
      console.error('Failed to link presales files:', error);
      return { success: false, error: 'Failed to link files' };
    }

    try {
      revalidatePath(`/projects/${projectId}`);
    } catch (e) {
      console.error('Revalidation error (non-fatal):', e);
    }

    return { success: true, linkedCount: data };
  } catch (error) {
    console.error('Link presales files error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link files',
    };
  }
}

/**
 * Migrate presales files to project files (copies to project_files table)
 */
export async function migratePresalesFilesToProject(
  dealId: string,
  projectId: string
): Promise<{ success: boolean; migratedCount?: number; error?: string }> {
  const supabase = await createClient();
  const db = await getTypedClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get project's SharePoint connection
  const { data: connection } = await db
    .from('project_sharepoint_connections')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();

  try {
    const { data, error } = await db.rpc('migrate_presales_to_project_files', {
      p_deal_id: dealId,
      p_project_id: projectId,
      p_connection_id: connection?.id || null,
    });

    if (error) {
      console.error('Failed to migrate presales files:', error);
      return { success: false, error: 'Failed to migrate files' };
    }

    try {
      revalidatePath(`/projects/${projectId}`);
    } catch (e) {
      console.error('Revalidation error (non-fatal):', e);
    }

    return { success: true, migratedCount: data };
  } catch (error) {
    console.error('Migrate presales files error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to migrate files',
    };
  }
}
