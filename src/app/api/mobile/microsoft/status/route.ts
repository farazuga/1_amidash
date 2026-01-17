import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Mobile API endpoint to check Microsoft connection status
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 *
 * Response:
 * - connected: boolean - Whether the user has connected their Microsoft account
 * - email: string | null - The connected Microsoft email
 * - expires_at: string | null - When the token expires (ISO 8601)
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

    // 2. Check for Microsoft connection
    const serviceClient = await createServiceClient();

    console.log('[Mobile Microsoft Status] Checking for user:', user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection, error: dbError } = await (serviceClient as any)
      .from('calendar_connections')
      .select('outlook_email, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .maybeSingle();

    console.log('[Mobile Microsoft Status] Query result:', { connection, dbError });

    return Response.json({
      connected: !!connection,
      email: connection?.outlook_email ?? null,
      expires_at: connection?.token_expires_at ?? null,
    });
  } catch (error) {
    console.error('[Mobile Microsoft Status] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
