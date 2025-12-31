import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadPresalesFile } from '@/app/(dashboard)/projects/[salesOrder]/files/actions';
import type { FileCategory } from '@/types';

/**
 * API route for presales file uploads (before project exists)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const dealId = formData.get('dealId') as string | null;
    const dealName = formData.get('dealName') as string | null;
    const category = formData.get('category') as FileCategory | null;
    const notes = formData.get('notes') as string | null;
    const capturedOffline = formData.get('capturedOffline') === 'true';
    const capturedOnDevice = formData.get('capturedOnDevice') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (!dealId) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Upload using the server action
    const result = await uploadPresalesFile({
      dealId,
      dealName: dealName || undefined,
      fileName: file.name,
      fileContent: arrayBuffer,
      contentType: file.type,
      category,
      notes: notes || undefined,
      capturedOffline,
      capturedOnDevice: capturedOnDevice || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      file: result.file,
    });
  } catch (error) {
    console.error('Presales file upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
