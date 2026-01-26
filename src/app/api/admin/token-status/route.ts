import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/token-status
 *
 * Debug endpoint to check Microsoft token status for all users.
 * Admin only.
 */
export async function GET() {
  try {
    // Check if user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all Microsoft connections
    const serviceClient = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connections, error: dbError } = await (serviceClient as any)
      .from('calendar_connections')
      .select(`
        id,
        user_id,
        provider,
        outlook_email,
        token_expires_at,
        created_at,
        updated_at
      `)
      .eq('provider', 'microsoft')
      .order('updated_at', { ascending: false });

    if (dbError) {
      return Response.json({ error: 'Database error', details: dbError.message }, { status: 500 });
    }

    // Get user names
    const userIds = connections?.map((c: { user_id: string }) => c.user_id) || [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Calculate token status for each connection
    const now = new Date();
    const tokenStatus = connections?.map((conn: {
      id: string;
      user_id: string;
      outlook_email: string;
      token_expires_at: string;
      created_at: string;
      updated_at: string;
    }) => {
      const expiresAt = new Date(conn.token_expires_at);
      const createdAt = new Date(conn.created_at);
      const updatedAt = new Date(conn.updated_at);

      const isExpired = expiresAt < now;
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const minutesUntilExpiry = Math.round(timeUntilExpiry / 1000 / 60);

      // Calculate how long since last refresh (updated_at is when tokens were last refreshed)
      const timeSinceRefresh = now.getTime() - updatedAt.getTime();
      const daysSinceRefresh = Math.round(timeSinceRefresh / 1000 / 60 / 60 / 24 * 10) / 10;

      // Calculate connection age
      const connectionAge = now.getTime() - createdAt.getTime();
      const daysConnected = Math.round(connectionAge / 1000 / 60 / 60 / 24);

      const profile = profileMap.get(conn.user_id);

      return {
        user: {
          id: conn.user_id,
          name: profile?.full_name || 'Unknown',
          email: profile?.email || 'Unknown',
        },
        microsoft_email: conn.outlook_email,
        access_token: {
          expires_at: conn.token_expires_at,
          is_expired: isExpired,
          minutes_until_expiry: isExpired ? 0 : minutesUntilExpiry,
          status: isExpired ? 'EXPIRED' : minutesUntilExpiry < 10 ? 'EXPIRING_SOON' : 'VALID',
        },
        refresh_token: {
          // Refresh tokens don't have visible expiry, but we can estimate based on usage
          last_used: conn.updated_at,
          days_since_refresh: daysSinceRefresh,
          estimated_status: daysSinceRefresh > 80 ? 'AT_RISK' : daysSinceRefresh > 60 ? 'SHOULD_REFRESH_SOON' : 'HEALTHY',
          // Refresh tokens expire after 90 days of inactivity
          estimated_days_remaining: Math.max(0, 90 - daysSinceRefresh),
        },
        connection: {
          created_at: conn.created_at,
          days_connected: daysConnected,
        },
      };
    }) || [];

    // Summary stats
    const summary = {
      total_connections: tokenStatus.length,
      access_tokens: {
        valid: tokenStatus.filter((t: { access_token: { status: string } }) => t.access_token.status === 'VALID').length,
        expiring_soon: tokenStatus.filter((t: { access_token: { status: string } }) => t.access_token.status === 'EXPIRING_SOON').length,
        expired: tokenStatus.filter((t: { access_token: { status: string } }) => t.access_token.status === 'EXPIRED').length,
      },
      refresh_tokens: {
        healthy: tokenStatus.filter((t: { refresh_token: { estimated_status: string } }) => t.refresh_token.estimated_status === 'HEALTHY').length,
        should_refresh_soon: tokenStatus.filter((t: { refresh_token: { estimated_status: string } }) => t.refresh_token.estimated_status === 'SHOULD_REFRESH_SOON').length,
        at_risk: tokenStatus.filter((t: { refresh_token: { estimated_status: string } }) => t.refresh_token.estimated_status === 'AT_RISK').length,
      },
      checked_at: now.toISOString(),
    };

    return Response.json({
      summary,
      connections: tokenStatus,
      notes: {
        access_token: 'Access tokens last ~1 hour. They auto-refresh using the refresh token.',
        refresh_token: 'Refresh tokens last 90 days of inactivity. Each use extends the 90-day window.',
        at_risk: 'Users with 80+ days since last refresh should use the app soon or they\'ll need to reconnect.',
      },
    });
  } catch (error) {
    console.error('[Token Status] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to check token status' },
      { status: 500 }
    );
  }
}
