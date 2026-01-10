/**
 * Retry sync for a specific assignment
 * POST /api/auth/microsoft/retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrySyncForAssignment } from '@/lib/microsoft-graph/sync';
import { z } from 'zod';

const retrySchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID format'),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate input
    const parseResult = retrySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { assignmentId } = parseResult.data;
    const result = await retrySyncForAssignment(assignmentId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Retry sync error:', err);
    return NextResponse.json(
      { error: 'Retry failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
