import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import { decryptToken, isEncryptionConfigured } from '@/lib/crypto';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';

// Type assertion for tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
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

    // Decrypt tokens if encryption is configured
    if (isEncryptionConfigured() && connection.access_token) {
      try {
        connection.access_token = decryptToken(connection.access_token);
        if (connection.refresh_token) {
          connection.refresh_token = decryptToken(connection.refresh_token);
        }
      } catch (err) {
        console.error('[SharePoint Drives] Token decryption failed:', err);
        return NextResponse.json(
          { error: 'Failed to decrypt tokens. Please reconnect your Microsoft account.' },
          { status: 400 }
        );
      }
    }

    // List drives (document libraries) in the site
    const drives = await sharepoint.listDrives(connection as CalendarConnection, siteId);

    return NextResponse.json({ drives });
  } catch (error) {
    console.error('Error listing SharePoint drives:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list drives' },
      { status: 500 }
    );
  }
}
