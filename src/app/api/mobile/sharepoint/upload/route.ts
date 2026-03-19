import { createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import type { FileCategory, FileCategoryWithLegacy, SharePointGlobalConfig } from '@/types';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { internalError } from '@/lib/api/error-response';
import { sanitizeFilename, stripExifData, validateMobileFileSize, validateMobileFileType } from '@/lib/mobile/file-security';

// Helper: Get global SharePoint config (uses service client)
async function getGlobalSharePointConfig(): Promise<SharePointGlobalConfig | null> {
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
    // 1. Authenticate and authorize (staff only)
    const authResult = await authenticateMobileRequest(request);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const rawCategory = formData.get('category') as FileCategoryWithLegacy | null;
    const notes = formData.get('notes') as string | null;

    // 3. Validate required fields
    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }
    if (!projectId) {
      return Response.json({ error: 'Project ID is required' }, { status: 400 });
    }
    if (!rawCategory) {
      return Response.json({ error: 'Category is required' }, { status: 400 });
    }

    // 4. Validate file size
    if (!validateMobileFileSize(file.size)) {
      return Response.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 });
    }

    // 5a. Read file buffer (needed for MIME validation and EXIF stripping)
    let fileBuffer = Buffer.from(await file.arrayBuffer()) as Buffer;

    // 5b. Validate file type (magic bytes)
    const typeCheck = await validateMobileFileType(fileBuffer, file.name);
    if (!typeCheck.valid) {
      return Response.json({ error: typeCheck.error }, { status: 400 });
    }

    // 5c. Sanitize filename
    const safeName = sanitizeFilename(file.name);

    // 6. Map legacy category values to current values
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

    // 7. Strip EXIF data from images
    if (file.type.startsWith('image/')) {
      fileBuffer = await stripExifData(fileBuffer, file.type) as Buffer;
    }

    // 8. Get service client for database operations
    const db = await createServiceClient();

    // 9. Get project details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project, error: projectError } = await (db as any)
      .from('projects')
      .select('client_name, sales_order_number')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // 10. Check if project already has a SharePoint connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: connection } = await (db as any)
      .from('project_sharepoint_connections')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    // 11. If no connection, auto-create project folder
    if (!connection) {
      const globalConfig = await getGlobalSharePointConfig();
      if (!globalConfig) {
        return Response.json(
          { error: 'SharePoint not configured. Contact your administrator.' },
          { status: 500 }
        );
      }

      try {
        const sanitizedClientName = project.client_name.replace(/[<>:"/\\|?*]/g, '-').trim();
        const folderName = `${project.sales_order_number} ${sanitizedClientName}`;

        const projectFolder = await sharepoint.createFolder(
          globalConfig.drive_id,
          globalConfig.base_folder_id,
          folderName
        );

        const categories: FileCategory[] = ['schematics', 'sow', 'media', 'other'];
        for (const cat of categories) {
          const categoryFolderName = sharepoint.getCategoryFolderName(cat);
          try {
            await sharepoint.createFolder(globalConfig.drive_id, projectFolder.id, categoryFolderName);
          } catch {
            // Category folder may already exist
          }
        }

        const folderPath = baseFolderToPath(globalConfig.base_folder_path, folderName);

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
      } catch (folderError) {
        console.error('[Mobile Upload] Folder creation error:', folderError);
        return Response.json({ error: 'Failed to create project folder' }, { status: 500 });
      }
    }

    // 12. Get or create category subfolder
    const categoryFolderName = sharepoint.getCategoryFolderName(category);
    let categoryFolder;

    try {
      categoryFolder = await sharepoint.getItemByPath(
        connection.drive_id,
        `${connection.folder_path}/${categoryFolderName}`
      );
    } catch {
      // Category folder not found, will create it
    }

    if (!categoryFolder) {
      try {
        const rootFolder = await sharepoint.getItem(connection.drive_id, connection.folder_id);
        await sharepoint.createFolder(connection.drive_id, rootFolder.id, categoryFolderName);
        categoryFolder = await sharepoint.getItemByPath(
          connection.drive_id,
          `${connection.folder_path}/${categoryFolderName}`
        );
      } catch (createError) {
        console.error('[Mobile Upload] Failed to create category folder:', createError);
      }
    }

    const targetFolderId = categoryFolder?.id || connection.folder_id;

    // 13. Upload to SharePoint
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: file.type });

    const uploadResult = await sharepoint.uploadFile(
      connection.drive_id,
      targetFolderId,
      safeName,
      blob,
      file.type
    );

    if (!uploadResult.success || !uploadResult.item) {
      console.error('[Mobile Upload] SharePoint upload failed:', uploadResult.error);
      return Response.json({ error: 'Upload failed' }, { status: 500 });
    }

    const spItem = uploadResult.item;

    // 14. Get thumbnail if available
    let thumbnailUrl: string | null = null;
    if (spItem.file?.mimeType?.startsWith('image/') || spItem.file?.mimeType?.startsWith('video/')) {
      try {
        const thumbnails = await sharepoint.getThumbnails(connection.drive_id, spItem.id);
        thumbnailUrl = thumbnails?.[0]?.medium?.url || thumbnails?.[0]?.small?.url || null;
      } catch {
        // Thumbnail not available
      }
    }

    // 15. Save file record to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fileRecord, error: insertError } = await (db as any)
      .from('project_files')
      .insert({
        project_id: projectId,
        connection_id: connection.id,
        file_name: safeName,
        sharepoint_item_id: spItem.id,
        category: category,
        file_size: spItem.size,
        mime_type: spItem.file?.mimeType || file.type,
        file_extension: getFileExtension(safeName),
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
      return Response.json({ error: 'Failed to save file record' }, { status: 500 });
    }

    return Response.json({
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    return internalError('Mobile SP Upload', error);
  }
}

function baseFolderToPath(baseFolderPath: string, folderName: string): string {
  return baseFolderPath === '/' || baseFolderPath === 'Root'
    ? `/${folderName}`
    : `${baseFolderPath}/${folderName}`;
}
