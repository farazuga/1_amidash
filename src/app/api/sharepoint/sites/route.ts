import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import { decryptToken, isEncryptionConfigured } from '@/lib/crypto';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';

// Type assertion for tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export async function GET() {
  try {
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
        console.error('[SharePoint Sites] Token decryption failed:', err);
        return NextResponse.json(
          { error: 'Failed to decrypt tokens. Please reconnect your Microsoft account.' },
          { status: 400 }
        );
      }
    }

    // List SharePoint sites
    const sites = await sharepoint.listSites(connection as CalendarConnection);

    return NextResponse.json({ sites });
  } catch (error) {
    console.error('Error listing SharePoint sites:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list sites' },
      { status: 500 }
    );
  }
}
