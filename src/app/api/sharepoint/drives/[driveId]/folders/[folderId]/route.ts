import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';

// Type assertion for tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

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

    // Get Microsoft connection
    const serviceClient = await createServiceClient() as AnySupabaseClient;
    const { data: connection, error: connError } = await serviceClient
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Please connect your Microsoft account first' },
        { status: 400 }
      );
    }

    // List folder contents (only folders, not files)
    const items = await sharepoint.listFolderContents(
      connection as CalendarConnection,
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
    console.error('Error listing SharePoint folders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list folders' },
      { status: 500 }
    );
  }
}
