import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import { internalError } from '@/lib/api/error-response';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ driveId: string; folderId: string }> }
) {
  try {
    const { driveId, folderId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // List folder contents (only folders, not files)
    const items = await sharepoint.listFolderContents(
      driveId,
      folderId
    );

    // Filter to only folders and format response
    const folders = items
      .filter(item => item.folder)
      .map(item => ({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl,
        childCount: item.folder?.childCount || 0,
        path: item.parentReference?.path
          ? `${item.parentReference.path}/${item.name}`
          : item.name,
      }));

    return NextResponse.json({ folders });
  } catch (error) {
    return internalError('SP Drives', error);
  }
}
