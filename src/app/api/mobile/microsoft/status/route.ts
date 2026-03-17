import { createClient } from '@supabase/supabase-js';

/**
 * Mobile API endpoint to check Microsoft connection status
 *
 * With app-level client credentials, this now returns connected: true
 * if the server has Microsoft env vars configured (no per-user connection needed).
 *
 * Response shape is unchanged for backwards compatibility:
 * - connected: boolean
 * - email: string | null (always null with app-level auth)
 * - expires_at: string | null (always null with app-level auth)
 */
export async function GET(request: Request) {
  try {
    // 1. Extract and verify Bearer token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 2. Check if Microsoft is configured at the app level
    const connected = !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_TENANT_ID
    );

    return Response.json({
      connected,
      email: null,
      expires_at: null,
    });
  } catch (error) {
    console.error('[Mobile Microsoft Status] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
