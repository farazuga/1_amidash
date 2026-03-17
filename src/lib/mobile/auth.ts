import { createClient } from '@supabase/supabase-js';

interface MobileAuthResult {
  user: { id: string; email?: string };
  profile: { role: string };
}

/**
 * Authenticate a mobile API request via Bearer token.
 * Returns user + profile on success, or a Response on failure.
 * Rejects customer-role users (customers use the portal, not mobile API).
 */
export async function authenticateMobileRequest(
  request: Request
): Promise<MobileAuthResult | Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.match(/^Bearer\s+(.+)$/)?.[1];

  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Fetch profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return Response.json({ error: 'User profile not found' }, { status: 403 });
  }

  // Reject customer role — customers use the portal
  if (profile.role === 'customer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { user, profile };
}
