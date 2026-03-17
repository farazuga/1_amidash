import { createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import type { FileCategory, FileCategoryWithLegacy, SharePointGlobalConfig } from '@/types';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { internalError } from '@/lib/api/error-response';
import { sanitizeFilename, stripExifData } from '@/lib/mobile/file-security';
import { validateMobileFileSize } from '@/lib/mobile/file-security';

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
    // 1. Authenticate and authorize (staff only)
    const authResult = await authenticateMobileRequest(request);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const referenceName = formData.get('referenceName') as string | null;
    const dealId = formData.get('dealId') as string | null;
    const dealName = formData.get('dealName') as string | null;
    const rawCategory = formData.get('category') as FileCategoryWithLegacy | null;
    const notes = formData.get('notes') as string | null;

    // 3. Validate required fields
    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }
    if (!referenceName || !referenceName.trim()) {
      return Response.json({ error: 'Reference name is required' }, { status: 400 });
    }
    if (!rawCategory) {
      return Response.json({ error: 'Category is required' }, { status: 400 });
    }

    // 4. Validate file size
    if (!validateMobileFileSize(file.size)) {
      return Response.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 });
    }

    // 5. Sanitize filename
    const safeName = sanitizeFilename(file.name);

    // 6. Map legacy category values
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

    // 7. Strip EXIF data from images
    let fileBuffer: Buffer = Buffer.from(await file.arrayBuffer()) as Buffer;
    if (file.type.startsWith('image/')) {
      fileBuffer = await stripExifData(fileBuffer, file.type) as Buffer;
    }

    // 8. Get global SharePoint config
    const globalConfig = await getGlobalSharePointConfig();
    if (!globalConfig) {
      return Response.json(
        { error: 'SharePoint not configured. Contact your administrator.' },
        { status: 500 }
      );
    }

    // 9. Find or create _PRESALES folder
    const driveId = globalConfig.drive_id;
    let presalesFolder;

    const baseFolderPath = globalConfig.base_folder_path;
    const parentPath = baseFolderPath === '/' || baseFolderPath === 'Root'
      ? ''
      : baseFolderPath.substring(0, baseFolderPath.lastIndexOf('/')) || '';

    let resolvedPresalesPath = parentPath ? `${parentPath}/_PRESALES` : '/_PRESALES';

    try {
      presalesFolder = await sharepoint.getItemByPath(driveId, resolvedPresalesPath);
    } catch {
      // Not found at sibling path
    }

    if (!presalesFolder) {
      try {
        presalesFolder = await sharepoint.getItemByPath(driveId, '/_PRESALES');
        resolvedPresalesPath = '/_PRESALES';
      } catch {
        // Not at root either
      }
    }

    if (!presalesFolder) {
      try {
        const rootFolder = await sharepoint.getItemByPath(driveId, '/');
        if (!rootFolder) {
          throw new Error('Could not access drive root');
        }
        presalesFolder = await sharepoint.createFolder(driveId, rootFolder.id, '_PRESALES');
        resolvedPresalesPath = '/_PRESALES';
      } catch (err) {
        console.error('[Mobile Presales] Failed to create _PRESALES folder:', err);
        return Response.json({ error: 'Failed to access presales folder' }, { status: 500 });
      }
    }

    // 10. Find or create reference subfolder within _PRESALES
    const sanitizedFolderName = sanitizedReference.replace(/[<>:"/\\|?*]/g, '-').trim();
    let referenceFolder;

    try {
      referenceFolder = await sharepoint.getItemByPath(
        driveId, `${resolvedPresalesPath}/${sanitizedFolderName}`
      );
    } catch {
      // Reference folder not found, will create
    }

    if (!referenceFolder?.id) {
      try {
        referenceFolder = await sharepoint.createFolder(
          driveId, presalesFolder.id, sanitizedFolderName
        );
      } catch (createErr) {
        console.error('[Mobile Presales] Failed to create reference folder:', createErr);
        return Response.json({ error: 'Failed to create presales reference folder' }, { status: 500 });
      }
    }

    const targetFolderId = referenceFolder?.id || presalesFolder.id;

    // 11. Upload to SharePoint
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: file.type });

    const uploadResult = await sharepoint.uploadFile(
      driveId,
      targetFolderId,
      safeName,
      blob,
      file.type
    );

    if (!uploadResult.success || !uploadResult.item) {
      console.error('[Mobile Presales] SharePoint upload failed:', uploadResult.error);
      return Response.json({ error: 'Upload failed' }, { status: 500 });
    }

    const spItem = uploadResult.item;

    // 12. Get thumbnail if available
    let thumbnailUrl: string | null = null;
    if (spItem.file?.mimeType?.startsWith('image/') || spItem.file?.mimeType?.startsWith('video/')) {
      try {
        const thumbnails = await sharepoint.getThumbnails(driveId, spItem.id);
        thumbnailUrl = thumbnails?.[0]?.medium?.url || thumbnails?.[0]?.small?.url || null;
      } catch {
        // Thumbnail not available
      }
    }

    // 13. Save to presales_files table
    const resolvedDealId = dealId || `mobile_${sanitizedReference.toLowerCase().replace(/\s+/g, '_')}`;
    const resolvedDealName = dealName || sanitizedReference;

    const db = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fileRecord, error: insertError } = await (db as any)
      .from('presales_files')
      .insert({
        activecampaign_deal_id: resolvedDealId,
        activecampaign_deal_name: resolvedDealName,
        file_name: safeName,
        sharepoint_item_id: spItem.id,
        category: category,
        file_size: spItem.size,
        mime_type: spItem.file?.mimeType || file.type,
        file_extension: getFileExtension(safeName),
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
      return Response.json({ error: 'Failed to save file record' }, { status: 500 });
    }

    return Response.json({
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    return internalError('Mobile Presales', error);
  }
}
