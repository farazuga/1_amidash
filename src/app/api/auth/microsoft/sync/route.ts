/**
 * Manual sync trigger for Microsoft Outlook calendar
 * POST /api/auth/microsoft/sync
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fullSyncForUser } from '@/lib/microsoft-graph/sync';
import { clearTokenCache } from '@/lib/microsoft-graph/auth';
import { internalError } from '@/lib/api/error-response';

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
    // Clear cached token to pick up any permission changes in Azure AD
    clearTokenCache();

    const result = await fullSyncForUser(user.id);

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors.slice(0, 10),
    });
  } catch (err) {
    return internalError('MS Sync', err);
  }
}
