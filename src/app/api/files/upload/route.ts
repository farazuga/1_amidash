import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadFile } from '@/app/(dashboard)/projects/[id]/files/actions';
import type { FileCategory, ProjectPhase } from '@/types';

/**
 * API route for file uploads (used by offline sync and direct uploads)
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
    const projectId = formData.get('projectId') as string | null;
    const category = formData.get('category') as FileCategory | null;
    const phase = formData.get('phase') as ProjectPhase | null;
    const notes = formData.get('notes') as string | null;
    const capturedOffline = formData.get('capturedOffline') === 'true';
    const capturedOnDevice = formData.get('capturedOnDevice') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Upload using the server action
    const result = await uploadFile({
      projectId,
      fileName: file.name,
      fileContent: arrayBuffer,
      contentType: file.type,
      category,
      phase: phase || undefined,
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
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
