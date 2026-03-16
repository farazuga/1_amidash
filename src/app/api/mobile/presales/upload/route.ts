import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import type { FileCategory, FileCategoryWithLegacy, SharePointGlobalConfig } from '@/types';

/**
 * Mobile API endpoint for uploading presales files to SharePoint _PRESALES folder
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 * SharePoint auth: App-level client credentials (no per-user Microsoft connection needed)
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Headers: Authorization: Bearer <supabase-jwt>
 * - Body fields:
 *   - file: The file to upload
 *   - referenceName: Free-text client/deal reference name (e.g. "Acme Corp Site Survey")
 *   - dealId (optional): ActiveCampaign deal ID (if selected from deal picker)
 *   - dealName (optional): ActiveCampaign deal title (if selected from deal picker)
 *   - category: File category (schematics, sow, media, other)
 *   - notes (optional): Notes about the file
 */

// Helper: Get global SharePoint config
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
    console.log('[Mobile Presales] === Starting presales upload ===');

    // 1. Extract Bearer token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 2. Verify token with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[Mobile Presales] Auth error:', authError);
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[Mobile Presales] User authenticated:', user.id);

    // 3. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const referenceName = formData.get('referenceName') as string | null;
    const dealId = formData.get('dealId') as string | null;
    const dealName = formData.get('dealName') as string | null;
    const rawCategory = formData.get('category') as FileCategoryWithLegacy | null;
    const notes = formData.get('notes') as string | null;

    // 4. Validate required fields
    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }
    if (!referenceName || !referenceName.trim()) {
      return Response.json({ error: 'Reference name is required' }, { status: 400 });
    }
    if (!rawCategory) {
      return Response.json({ error: 'Category is required' }, { status: 400 });
    }

    // 5. Map legacy category values
    let category: FileCategory;
    if (rawCategory === 'photos' || rawCategory === 'videos') {
      category = 'media';
    } else if (['schematics', 'sow', 'media', 'other'].includes(rawCategory)) {
      category = rawCategory as FileCategory;
    } else {
      return Response.json(
        { error: 'Invalid category. Valid values: schematics, sow, media, other' },
        { status: 400 }
      );
    }

    const sanitizedReference = referenceName.trim();

    console.log('[Mobile Presales] Input validated:', {
      fileName: file.name,
      fileSize: file.size,
      category,
      referenceName: sanitizedReference,
    });

    // 6. Get global SharePoint config
    const globalConfig = await getGlobalSharePointConfig();
    if (!globalConfig) {
      return Response.json(
        { error: 'SharePoint not configured. Contact your administrator.' },
        { status: 500 }
      );
    }

    // 7. Find or create _PRESALES folder
    const driveId = globalConfig.drive_id;
    let presalesFolder;

    // Try to find _PRESALES folder as sibling of the base folder
    const baseFolderPath = globalConfig.base_folder_path;
    const parentPath = baseFolderPath === '/' || baseFolderPath === 'Root'
      ? ''
      : baseFolderPath.substring(0, baseFolderPath.lastIndexOf('/')) || '';

    let resolvedPresalesPath = parentPath ? `${parentPath}/_PRESALES` : '/_PRESALES';

    try {
      presalesFolder = await sharepoint.getItemByPath(driveId, resolvedPresalesPath);
      console.log('[Mobile Presales] Found _PRESALES folder:', presalesFolder?.id);
    } catch {
      console.log('[Mobile Presales] _PRESALES folder not found at', resolvedPresalesPath);
    }

    // If not found as sibling, try at drive root
    if (!presalesFolder) {
      try {
        presalesFolder = await sharepoint.getItemByPath(driveId, '/_PRESALES');
        resolvedPresalesPath = '/_PRESALES';
        console.log('[Mobile Presales] Found _PRESALES at root:', presalesFolder?.id);
      } catch {
        console.log('[Mobile Presales] _PRESALES not at root either, creating it');
      }
    }

    // Create _PRESALES folder at root if it doesn't exist
    if (!presalesFolder) {
      try {
        const rootFolder = await sharepoint.getItemByPath(driveId, '/');
        if (!rootFolder) {
          throw new Error('Could not access drive root');
        }
        presalesFolder = await sharepoint.createFolder(driveId, rootFolder.id, '_PRESALES');
        resolvedPresalesPath = '/_PRESALES';
        console.log('[Mobile Presales] Created _PRESALES folder:', presalesFolder.id);
      } catch (err) {
        console.error('[Mobile Presales] Failed to create _PRESALES folder:', err);
        return Response.json(
          { error: 'Failed to access presales folder' },
          { status: 500 }
        );
      }
    }

    // 8. Find or create reference subfolder within _PRESALES
    const sanitizedFolderName = sanitizedReference.replace(/[<>:"/\\|?*]/g, '-').trim();
    let referenceFolder;

    try {
      referenceFolder = await sharepoint.getItemByPath(
        driveId, `${resolvedPresalesPath}/${sanitizedFolderName}`
      );
      console.log('[Mobile Presales] Found reference folder:', referenceFolder?.id);
    } catch {
      console.log('[Mobile Presales] Reference folder not found by path, will create');
    }

    // Create reference folder if getItemByPath returned undefined or threw
    if (!referenceFolder?.id) {
      try {
        referenceFolder = await sharepoint.createFolder(
          driveId, presalesFolder.id, sanitizedFolderName
        );
        console.log('[Mobile Presales] Created reference folder:', sanitizedFolderName);
      } catch (createErr) {
        console.error('[Mobile Presales] Failed to create reference folder:', createErr);
        return Response.json(
          { error: 'Failed to create presales reference folder' },
          { status: 500 }
        );
      }
    }

    const targetFolderId = referenceFolder?.id || presalesFolder.id;

    // 9. Upload to SharePoint
    console.log('[Mobile Presales] Uploading to SharePoint...');
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    const uploadResult = await sharepoint.uploadFile(
      driveId,
      targetFolderId,
      file.name,
      blob,
      file.type
    );

    if (!uploadResult.success || !uploadResult.item) {
      console.error('[Mobile Presales] SharePoint upload failed:', uploadResult.error);
      return Response.json({ error: uploadResult.error || 'Upload failed' }, { status: 500 });
    }

    const spItem = uploadResult.item;
    console.log('[Mobile Presales] SharePoint upload complete');

    // 10. Get thumbnail if available
    let thumbnailUrl: string | null = null;
    if (spItem.file?.mimeType?.startsWith('image/') || spItem.file?.mimeType?.startsWith('video/')) {
      try {
        const thumbnails = await sharepoint.getThumbnails(driveId, spItem.id);
        thumbnailUrl = thumbnails?.[0]?.medium?.url || thumbnails?.[0]?.small?.url || null;
      } catch {
        console.log('[Mobile Presales] Thumbnail not available');
      }
    }

    // 11. Save to presales_files table
    const resolvedDealId = dealId || `mobile_${sanitizedReference.toLowerCase().replace(/\s+/g, '_')}`;
    const resolvedDealName = dealName || sanitizedReference;

    const db = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fileRecord, error: insertError } = await (db as any)
      .from('presales_files')
      .insert({
        activecampaign_deal_id: resolvedDealId,
        activecampaign_deal_name: resolvedDealName,
        file_name: file.name,
        sharepoint_item_id: spItem.id,
        category: category,
        file_size: spItem.size,
        mime_type: spItem.file?.mimeType || file.type,
        file_extension: getFileExtension(file.name),
        web_url: spItem.webUrl,
        download_url: spItem['@microsoft.graph.downloadUrl'],
        thumbnail_url: thumbnailUrl,
        sharepoint_folder_path: `${resolvedPresalesPath}/${sanitizedFolderName}`,
        uploaded_by: user.id,
        upload_status: 'uploaded',
        notes: notes,
        captured_on_device: 'ios',
        captured_offline: false,
      })
      .select(`
        *,
        uploaded_by_profile:profiles!presales_files_uploaded_by_fkey(id, email, full_name)
      `)
      .single();

    if (insertError) {
      console.error('[Mobile Presales] Database insert error:', insertError);
      return Response.json(
        { error: `Database error: ${insertError.message || 'Failed to save record'}` },
        { status: 500 }
      );
    }

    console.log('[Mobile Presales] === Upload complete ===');
    console.log('[Mobile Presales] File saved with ID:', fileRecord?.id);

    return Response.json({
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    console.error('[Mobile Presales] Unexpected error:', error);

    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
