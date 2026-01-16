/**
 * Get sync errors for the current user
 * GET /api/auth/microsoft/errors
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSyncErrors } from '@/lib/microsoft-graph/sync';

export async function GET() {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await getSyncErrors(user.id);

    return NextResponse.json({
      success: true,
      errors: result.errors,
      count: result.count,
    });
  } catch (err) {
    console.error('Failed to fetch sync errors:', err);
    return NextResponse.json(
      { error: 'Failed to fetch sync errors' },
      { status: 500 }
    );
  }
}
