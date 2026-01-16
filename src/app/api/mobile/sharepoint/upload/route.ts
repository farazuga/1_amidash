import { createClient } from '@supabase/supabase-js';
import { uploadFile } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';
import type { FileCategory, FileCategoryWithLegacy } from '@/types';

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
export async function POST(request: Request) {
  try {
    // 1. Extract Bearer token from Authorization header
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
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

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
    // photos and videos are legacy values that map to media
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

    // 6. Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 7. Upload using existing server action
    // Note: The uploadFile action handles:
    // - Getting the user's Microsoft connection
    // - Auto-creating project SharePoint folder if needed
    // - Creating category subfolders
    // - Token refresh if Microsoft token is expired
    const result = await uploadFile({
      projectId,
      fileName: file.name,
      fileContent: arrayBuffer,
      contentType: file.type,
      category,
      notes: notes || undefined,
      capturedOnDevice: 'ios',
    });

    if (!result.success) {
      // Map error messages to appropriate status codes
      if (result.error?.includes('Microsoft account')) {
        return Response.json({ error: 'Please connect your Microsoft account in the web app' }, { status: 403 });
      }
      if (result.error?.includes('not found')) {
        return Response.json({ error: result.error }, { status: 404 });
      }
      return Response.json({ error: result.error || 'Upload failed' }, { status: 500 });
    }

    return Response.json({
      success: true,
      file: result.file,
    });
  } catch (error) {
    console.error('[Mobile Upload] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
