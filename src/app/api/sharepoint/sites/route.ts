import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // List SharePoint sites
    const sites = await sharepoint.listSites();

    return NextResponse.json({ sites });
  } catch (error) {
    console.error('Error listing SharePoint sites:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list sites' },
      { status: 500 }
    );
  }
}
