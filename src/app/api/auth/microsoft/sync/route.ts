/**
 * Manual sync trigger for Microsoft Outlook calendar
 * POST /api/auth/microsoft/sync
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fullSyncForUser } from '@/lib/microsoft-graph/sync';

export async function POST() {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await fullSyncForUser(user.id);

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.slice(0, 5), // Limit errors returned
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json(
      { error: 'Sync failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
