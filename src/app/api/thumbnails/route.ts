import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Upload a thumbnail to Supabase storage
 * Returns the public URL
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
    const file = formData.get('thumbnail') as File | null;
    const fileId = formData.get('fileId') as string | null;
    const fileType = formData.get('fileType') as 'project' | 'presales' | null;

    if (!file) {
      return NextResponse.json({ error: 'Thumbnail file is required' }, { status: 400 });
    }

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 });
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      return NextResponse.json({ error: 'Thumbnail must be under 1MB' }, { status: 400 });
    }

    // Create unique path: userId/fileId.jpg
    const extension = file.type.split('/')[1] || 'jpg';
    const path = `${user.id}/${fileId}.${extension}`;

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Thumbnail upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload thumbnail' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(path);

    // Update the file record with thumbnail URL
    const table = fileType === 'presales' ? 'presales_files' : 'project_files';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from(table)
      .update({ local_thumbnail_url: publicUrl })
      .eq('id', fileId);

    if (updateError) {
      console.error('Failed to update file record:', updateError);
      // Don't fail the request, thumbnail is uploaded
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload thumbnail' },
      { status: 500 }
    );
  }
}
