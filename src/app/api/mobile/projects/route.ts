import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Mobile API endpoint to list projects the user can upload files to
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 *
 * Response:
 * - projects: Array of projects with id, sales_order, client_name, status
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

    // 2. Get projects
    // Using service client to ensure we can read all projects
    const serviceClient = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects, error: projectsError } = await (serviceClient as any)
      .from('projects')
      .select('id, sales_order, client_name, status, phase')
      .in('phase', ['sold', 'active', 'on_hold']) // Only show projects that are in progress
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('[Mobile Projects] Database error:', projectsError);
      return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return Response.json({
      projects: projects || [],
    });
  } catch (error) {
    console.error('[Mobile Projects] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
