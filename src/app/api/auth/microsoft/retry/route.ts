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

// Rate limiting: 10 second cooldown between retries for the same user+assignment
const RETRY_COOLDOWN_MS = 10000;
const retryCooldowns = new Map<string, number>();

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of retryCooldowns.entries()) {
    if (now - timestamp > RETRY_COOLDOWN_MS * 6) {
      retryCooldowns.delete(key);
    }
  }
}, 5 * 60 * 1000);

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

    // Check rate limit
    const cooldownKey = `${user.id}:${assignmentId}`;
    const lastRetry = retryCooldowns.get(cooldownKey);
    if (lastRetry && Date.now() - lastRetry < RETRY_COOLDOWN_MS) {
      const waitTime = Math.ceil((RETRY_COOLDOWN_MS - (Date.now() - lastRetry)) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitTime} seconds before retrying again` },
        { status: 429 }
      );
    }

    // Update cooldown timestamp before processing
    retryCooldowns.set(cooldownKey, Date.now());

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
      { error: 'Retry failed' },
      { status: 500 }
    );
  }
}
