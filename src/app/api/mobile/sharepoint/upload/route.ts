import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import { MicrosoftAuthError } from '@/lib/sharepoint/client';
import { decryptToken, isEncryptionConfigured } from '@/lib/crypto';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';
import type { FileCategory, FileCategoryWithLegacy, SharePointGlobalConfig } from '@/types';

/**
 * Mobile API endpoint for uploading files to SharePoint
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Headers: Authorization: Bearer <supabase-jwt>
 * - Body fields:
 *   - file: The file to upload
 *   - projectId: Project database UUID (not sales order number)
 *   - category: File category (schematics, sow, media, other)
 *   - notes (optional): Notes about the file
 */

// Helper: Get Microsoft connection for a user (uses service client)
async function getMicrosoftConnectionForMobile(userId: string): Promise<CalendarConnection | null> {
  const supabase = await createServiceClient();

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

  // Decrypt tokens if encryption is configured
  if (isEncryptionConfigured() && data.access_token) {
    try {
      data.access_token = decryptToken(data.access_token);
      if (data.refresh_token) {
        data.refresh_token = decryptToken(data.refresh_token);
      }
    } catch (err) {
      console.error('[Mobile Upload] Token decryption failed:', err);
      return null;
    }
  }

  return data as CalendarConnection;
}

// Helper: Get global SharePoint config (uses service client)
async function getGlobalSharePointConfigForMobile(): Promise<SharePointGlobalConfig | null> {
  const db = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db as any)
    .from('app_settings')
    .select('value')
    .eq('key', 'sharepoint_config')
    .maybeSingle();

  if (!data || !data.value) {
    return null;
  }

  return data.value as SharePointGlobalConfig;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export async function POST(request: Request) {
  try {
    console.log('[Mobile Upload] === STEP 1: Starting upload ===');

    // 1. Extract Bearer token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 2. Verify token with Supabase (using anon key client, not cookie-based)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Mobile Upload] Auth error:', authError);
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[Mobile Upload] User authenticated:', user.id);

    // 3. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const rawCategory = formData.get('category') as FileCategoryWithLegacy | null;
    const notes = formData.get('notes') as string | null;

    // 4. Validate required fields
    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }
    if (!projectId) {
      return Response.json({ error: 'Project ID is required' }, { status: 400 });
    }
    if (!rawCategory) {
      return Response.json({ error: 'Category is required' }, { status: 400 });
    }

    // 5. Map legacy category values to current values
    let category: FileCategory;
    if (rawCategory === 'photos' || rawCategory === 'videos') {
      category = 'media';
    } else if (['schematics', 'sow', 'media', 'other'].includes(rawCategory)) {
      category = rawCategory as FileCategory;
    } else {
      return Response.json(
        { error: `Invalid category. Valid values: schematics, sow, media, other` },
        { status: 400 }
      );
    }

    console.log('[Mobile Upload] Input validated:', {
      fileName: file.name,
      fileSize: file.size,
      category,
      projectId,
    });

    // 6. Get Microsoft connection
    const msConnection = await getMicrosoftConnectionForMobile(user.id);
    if (!msConnection) {
      console.error('[Mobile Upload] No Microsoft connection for user:', user.id);
      return Response.json(
        { error: 'Please connect your Microsoft account in the web app' },
        { status: 403 }
      );
    }
    console.log('[Mobile Upload] Microsoft connection found');

    // 7. Get service client for database operations
    const db = await createServiceClient();

    // 8. Get project details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project, error: projectError } = await (db as any)
      .from('projects')
      .select('client_name, sales_order_number')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[Mobile Upload] Project not found:', projectError);
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    console.log('[Mobile Upload] Project found:', project.sales_order_number, project.client_name);

    // 9. Check if project already has a SharePoint connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: connection } = await (db as any)
      .from('project_sharepoint_connections')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    // 10. If no connection, auto-create project folder
    if (!connection) {
      console.log('[Mobile Upload] No existing connection, auto-creating folder...');

      const globalConfig = await getGlobalSharePointConfigForMobile();
      if (!globalConfig) {
        return Response.json(
          { error: 'SharePoint not configured. Contact your administrator.' },
          { status: 500 }
        );
      }

      try {
        // Generate folder name: "S12345 ClientName"
        const sanitizedClientName = project.client_name.replace(/[<>:"/\\|?*]/g, '-').trim();
        const folderName = `${project.sales_order_number} ${sanitizedClientName}`;

        // Create project folder under the base folder
        const projectFolder = await sharepoint.createFolder(
          msConnection,
          globalConfig.drive_id,
          globalConfig.base_folder_id,
          folderName
        );

        // Create category subfolders
        const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];
        for (const cat of categories) {
          const categoryFolderName = sharepoint.getCategoryFolderName(cat);
          try {
            await sharepoint.createFolder(msConnection, globalConfig.drive_id, projectFolder.id, categoryFolderName);
          } catch {
            console.log(`[Mobile Upload] Category folder ${categoryFolderName} may already exist`);
          }
        }

        // Save connection to database
        const folderPath = globalConfig.base_folder_path === '/' || globalConfig.base_folder_path === 'Root'
          ? `/${folderName}`
          : `${globalConfig.base_folder_path}/${folderName}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newConnection, error: insertError } = await (db as any)
          .from('project_sharepoint_connections')
          .insert({
            project_id: projectId,
            site_id: globalConfig.site_id,
            drive_id: globalConfig.drive_id,
            folder_id: projectFolder.id,
            folder_path: folderPath,
            folder_url: projectFolder.webUrl,
            connected_by: user.id,
            auto_created: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[Mobile Upload] Failed to save connection:', insertError);
          return Response.json({ error: 'Failed to setup project folder' }, { status: 500 });
        }

        connection = newConnection;
        console.log('[Mobile Upload] Project folder created:', folderPath);
      } catch (folderError) {
        console.error('[Mobile Upload] Folder creation error:', folderError);
        return Response.json(
          { error: folderError instanceof Error ? folderError.message : 'Failed to create project folder' },
          { status: 500 }
        );
      }
    }

    console.log('[Mobile Upload] Using connection:', connection.folder_path);

    // 11. Get or create category subfolder
    const categoryFolderName = sharepoint.getCategoryFolderName(category);
    let categoryFolder;

    try {
      categoryFolder = await sharepoint.getItemByPath(
        msConnection,
        connection.drive_id,
        `${connection.folder_path}/${categoryFolderName}`
      );
      console.log('[Mobile Upload] Category folder found:', categoryFolder?.id);
    } catch {
      console.log('[Mobile Upload] Category folder not found, will create it');
    }

    if (!categoryFolder) {
      try {
        const rootFolder = await sharepoint.getItem(msConnection, connection.drive_id, connection.folder_id);
        await sharepoint.createFolder(msConnection, connection.drive_id, rootFolder.id, categoryFolderName);
        console.log('[Mobile Upload] Category folder created');

        // Get the newly created folder
        categoryFolder = await sharepoint.getItemByPath(
          msConnection,
          connection.drive_id,
          `${connection.folder_path}/${categoryFolderName}`
        );
      } catch (createError) {
        console.error('[Mobile Upload] Failed to create category folder:', createError);
      }
    }

    const targetFolderId = categoryFolder?.id || connection.folder_id;

    // 12. Upload to SharePoint
    console.log('[Mobile Upload] === Uploading to SharePoint ===');
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    const uploadResult = await sharepoint.uploadFile(
      msConnection,
      connection.drive_id,
      targetFolderId,
      file.name,
      blob,
      file.type
    );

    console.log('[Mobile Upload] SharePoint upload result:', {
      success: uploadResult.success,
      error: uploadResult.error,
      itemId: uploadResult.item?.id,
    });

    if (!uploadResult.success || !uploadResult.item) {
      console.error('[Mobile Upload] SharePoint upload failed:', uploadResult.error);
      return Response.json({ error: uploadResult.error || 'Upload failed' }, { status: 500 });
    }

    const spItem = uploadResult.item;
    console.log('[Mobile Upload] SharePoint upload complete');

    // 13. Get thumbnail if available
    let thumbnailUrl: string | null = null;
    if (spItem.file?.mimeType?.startsWith('image/') || spItem.file?.mimeType?.startsWith('video/')) {
      try {
        const thumbnails = await sharepoint.getThumbnails(msConnection, connection.drive_id, spItem.id);
        thumbnailUrl = thumbnails?.[0]?.medium?.url || thumbnails?.[0]?.small?.url || null;
        console.log('[Mobile Upload] Thumbnail URL:', thumbnailUrl ? 'obtained' : 'not available');
      } catch {
        console.log('[Mobile Upload] Thumbnail not available');
      }
    }

    // 14. Save file record to database
    console.log('[Mobile Upload] === Saving to database ===');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fileRecord, error: insertError } = await (db as any)
      .from('project_files')
      .insert({
        project_id: projectId,
        connection_id: connection.id,
        file_name: file.name,
        sharepoint_item_id: spItem.id,
        category: category,
        file_size: spItem.size,
        mime_type: spItem.file?.mimeType || file.type,
        file_extension: getFileExtension(file.name),
        web_url: spItem.webUrl,
        download_url: spItem['@microsoft.graph.downloadUrl'],
        thumbnail_url: thumbnailUrl,
        uploaded_by: user.id,
        sharepoint_modified_by: spItem.lastModifiedBy?.user?.email,
        sharepoint_modified_at: spItem.lastModifiedDateTime,
        notes: notes,
        upload_status: 'uploaded',
        is_synced: true,
        captured_on_device: 'ios',
        captured_offline: false,
      })
      .select(`
        *,
        uploaded_by_profile:profiles!project_files_uploaded_by_fkey(id, email, full_name)
      `)
      .single();

    if (insertError) {
      console.error('[Mobile Upload] Database insert error:', insertError);
      return Response.json(
        { error: `Database error: ${insertError.message || 'Failed to save record'}` },
        { status: 500 }
      );
    }

    console.log('[Mobile Upload] === Upload complete ===');
    console.log('[Mobile Upload] File saved with ID:', fileRecord?.id);

    return Response.json({
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    console.error('[Mobile Upload] Unexpected error:', error);

    // Check if this is a Microsoft authentication error requiring reconnection
    if (error instanceof MicrosoftAuthError) {
      return Response.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
