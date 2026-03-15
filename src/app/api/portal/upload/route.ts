import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getServiceRoleKey } from '@/lib/supabase/server';
import { validateFileType, sanitizeFilename, validateFileSize, stripExifData } from '@/lib/portal/file-security';
import { checkUploadRateLimit } from '@/lib/portal/rate-limit';
import { sendEmail } from '@/lib/email/send';
import { fileUploadNotificationEmail } from '@/lib/email/templates';
import * as sharepoint from '@/lib/sharepoint/client';
import { decryptToken, isEncryptionConfigured } from '@/lib/crypto';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';
import type { SharePointGlobalConfig } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

/**
 * Get a typed service client for untyped tables
 */
function getServiceDb(): AnySupabaseClient {
  const { url } = getSupabaseEnv();
  return createClient(url, getServiceRoleKey());
}

/**
 * Get Microsoft connection for a specific user (for SharePoint uploads).
 * Portal uploads use an admin's Microsoft credentials.
 */
async function getMicrosoftConnectionForPortal(userId: string): Promise<CalendarConnection | null> {
  const supabase = getServiceDb();

  const { data, error } = await supabase
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
      console.error('[Portal Upload] Token decryption failed:', err);
      return null;
    }
  }

  return data as CalendarConnection;
}

/**
 * Get the global SharePoint configuration from app_settings
 */
async function getSharePointConfig(): Promise<SharePointGlobalConfig | null> {
  const db = getServiceDb();
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

export async function POST(request: NextRequest) {
  try {
    // 1. Parse multipart form data
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const blockId = formData.get('blockId') as string;
    const slotIndex = parseInt(formData.get('slotIndex') as string, 10);
    const fileLabel = formData.get('fileLabel') as string;
    const fileDescription = formData.get('fileDescription') as string | null;
    const file = formData.get('file') as File;

    if (!token || !blockId || isNaN(slotIndex) || !file || !fileLabel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Validate token -> get project (service role since portal has no auth)
    const db = getServiceDb();

    let { data: project, error: projectError } = await db
      .from('projects')
      .select('id, client_name, sales_order_number')
      .eq('client_token', token)
      .eq('is_draft', false)
      .single();

    // Fallback if is_draft column doesn't exist yet (migration 050 not applied)
    if (projectError) {
      const retry = await db
        .from('projects')
        .select('id, client_name, sales_order_number')
        .eq('client_token', token)
        .single();
      project = retry.data;
      projectError = retry.error;
    }

    if (projectError || !project) {
      return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 });
    }

    // 3. Rate limit check
    if (!checkUploadRateLimit(token)) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    // 4. Validate file size
    if (!validateFileSize(file.size)) {
      return NextResponse.json({ error: 'File exceeds 3MB limit' }, { status: 400 });
    }

    // 5. Read file buffer, validate file type
    const buffer = Buffer.from(await file.arrayBuffer());
    const typeCheck = await validateFileType(buffer, file.name);
    if (!typeCheck.valid) {
      return NextResponse.json({ error: typeCheck.error }, { status: 400 });
    }

    // 6. Strip EXIF if image
    const cleanBuffer = await stripExifData(buffer, typeCheck.mimeType!);

    // 7. Sanitize filename
    const storedFilename = sanitizeFilename(file.name);

    // 8-9. Try to upload to SharePoint if configured (non-blocking)
    let sharepointItemId: string | null = null;
    let sharepointWebUrl: string | null = null;

    try {
      const spConfig = await getSharePointConfig();
      if (spConfig) {
        // Find an admin user with a Microsoft connection to use for SharePoint
        // Check the project's existing SharePoint connection for connected_by user
        const { data: spConnection } = await db
          .from('project_sharepoint_connections')
          .select('connected_by, drive_id, folder_id, folder_path')
          .eq('project_id', project.id)
          .maybeSingle();

        let msUserId: string | null = spConnection?.connected_by || null;

        // If no project connection, try to find any admin with Microsoft connected
        if (!msUserId) {
          const { data: adminConnection } = await db
            .from('calendar_connections')
            .select('user_id')
            .eq('provider', 'microsoft')
            .limit(1)
            .maybeSingle();

          msUserId = adminConnection?.user_id || null;
        }

        if (msUserId) {
          const msConnection = await getMicrosoftConnectionForPortal(msUserId);
          if (msConnection) {
            // Determine upload folder: use project connection or project root
            let targetDriveId = spConfig.drive_id;
            let targetFolderId = spConfig.base_folder_id;

            if (spConnection) {
              targetDriveId = spConnection.drive_id;
              // Try to use or create client_uploads subfolder
              try {
                const uploadsFolder = await sharepoint.getItemByPath(
                  msConnection,
                  targetDriveId,
                  `${spConnection.folder_path}/client_uploads`
                );
                if (uploadsFolder) {
                  targetFolderId = uploadsFolder.id;
                }
              } catch {
                // Create client_uploads folder
                try {
                  const newFolder = await sharepoint.createFolder(
                    msConnection,
                    targetDriveId,
                    spConnection.folder_id,
                    'client_uploads'
                  );
                  targetFolderId = newFolder.id;
                } catch (folderErr) {
                  console.error('[Portal Upload] Failed to create client_uploads folder:', folderErr);
                  targetFolderId = spConnection.folder_id;
                }
              }
            }

            // Upload file to SharePoint
            const blob = new Blob([new Uint8Array(cleanBuffer)], { type: typeCheck.mimeType! });
            const uploadResult = await sharepoint.uploadFile(
              msConnection,
              targetDriveId,
              targetFolderId,
              storedFilename,
              blob,
              typeCheck.mimeType!
            );

            if (uploadResult.success && uploadResult.item) {
              sharepointItemId = uploadResult.item.id;
              sharepointWebUrl = uploadResult.item.webUrl;
            }
          }
        }
      }
    } catch (spError) {
      console.error('[Portal Upload] SharePoint upload failed (non-blocking):', spError);
    }

    // 10. Insert portal_file_uploads row
    const uploadRecord = {
      project_id: project.id,
      block_id: blockId,
      file_label: fileLabel,
      file_description: fileDescription || null,
      slot_index: slotIndex,
      original_filename: file.name,
      stored_filename: storedFilename,
      file_size_bytes: cleanBuffer.length,
      mime_type: typeCheck.mimeType,
      sharepoint_item_id: sharepointItemId,
      sharepoint_web_url: sharepointWebUrl,
      upload_status: 'uploaded',
      uploaded_at: new Date().toISOString(),
    };

    const { data: uploadData, error: insertError } = await db
      .from('portal_file_uploads')
      .insert(uploadRecord)
      .select('id')
      .single();

    if (insertError || !uploadData) {
      console.error('[Portal Upload] Database insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save upload record' }, { status: 500 });
    }

    // 11. Get customer_approval_user_id from app_settings
    const { data: approvalSetting } = await db
      .from('app_settings')
      .select('value')
      .eq('key', 'customer_approval_user_id')
      .single();

    const approvalUserId =
      approvalSetting?.value && approvalSetting.value !== 'null'
        ? (typeof approvalSetting.value === 'string'
            ? approvalSetting.value
            : String(approvalSetting.value))
        : null;

    // 12. Create customer_approval_tasks row if approval user is set
    if (approvalUserId) {
      const { error: taskError } = await db
        .from('customer_approval_tasks')
        .insert({
          file_upload_id: uploadData.id,
          assigned_to: approvalUserId,
          status: 'pending',
        });

      if (taskError) {
        console.error('[Portal Upload] Failed to create approval task:', taskError);
        // Non-blocking - upload still succeeded
      }

      // 13. Send notification email to approval user (fire-and-forget)
      try {
        const { data: approvalUser } = await db
          .from('profiles')
          .select('email, full_name')
          .eq('id', approvalUserId)
          .single();

        if (approvalUser?.email) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const approvalDashboardUrl = `${baseUrl}/projects/${project.sales_order_number}/files`;

          const html = fileUploadNotificationEmail({
            projectName: `${project.sales_order_number} ${project.client_name}`,
            fileName: file.name,
            uploaderInfo: 'Customer (via portal)',
            approvalDashboardUrl,
          });

          // Fire-and-forget - don't await
          sendEmail({
            to: approvalUser.email,
            subject: `New file upload for ${project.sales_order_number} - Review needed`,
            html,
          }).catch((emailErr) => {
            console.error('[Portal Upload] Email send failed:', emailErr);
          });
        }
      } catch (emailError) {
        console.error('[Portal Upload] Email notification failed (non-blocking):', emailError);
      }
    }

    // 14. Return success
    return NextResponse.json({ success: true, uploadId: uploadData.id });
  } catch (error) {
    console.error('[Portal Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
