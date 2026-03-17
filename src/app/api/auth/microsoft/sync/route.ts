/**
 * Manual sync trigger for Microsoft Outlook calendar
 * POST /api/auth/microsoft/sync
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fullSyncForUser, fullProjectsSyncForUser } from '@/lib/microsoft-graph/sync';
import { clearTokenCache } from '@/lib/microsoft-graph/auth';

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

    // Sync both personal and projects calendars in parallel
    const [personalResult, projectsResult] = await Promise.all([
      fullSyncForUser(user.id),
      fullProjectsSyncForUser(user.id),
    ]);

    return NextResponse.json({
      success: true,
      personal: { synced: personalResult.synced, failed: personalResult.failed },
      projects: { synced: projectsResult.synced, failed: projectsResult.failed },
      synced: personalResult.synced + projectsResult.synced,
      failed: personalResult.failed + projectsResult.failed,
      errors: [...personalResult.errors, ...projectsResult.errors].slice(0, 10),
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json(
      { error: 'Sync failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
