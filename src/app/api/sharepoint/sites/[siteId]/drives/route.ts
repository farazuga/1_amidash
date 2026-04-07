import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as sharepoint from '@/lib/sharepoint/client';
import { internalError } from '@/lib/api/error-response';

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

    // List drives (document libraries) in the site
    const drives = await sharepoint.listDrives(siteId);

    return NextResponse.json({ drives });
  } catch (error) {
    return internalError('SP Site Drives', error);
  }
}
