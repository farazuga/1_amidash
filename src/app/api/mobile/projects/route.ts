import { createClient } from '@supabase/supabase-js';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { internalError } from '@/lib/api/error-response';

/**
 * Mobile API endpoint to list projects the user can upload files to
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 * Authorization: Staff only (admin/editor/viewer) — customers use portal
 *
 * Response:
 * - projects: Array of projects with id, sales_order, client_name, status
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize (staff only)
    const authResult = await authenticateMobileRequest(request);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    // 2. Get projects using user-scoped client (respects RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/)?.[1]}` } } }
    );

    // Set the user's auth context
    await supabase.auth.getUser(request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/)?.[1]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: projects, error: projectsError } = await (supabase as any)
      .from('projects')
      .select('id, sales_order_number, client_name, current_status_id, is_draft')
      .eq('is_draft', false)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('[Mobile Projects] Database error:', projectsError);
      return Response.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return Response.json({
      projects: projects || [],
    });
  } catch (error) {
    return internalError('Mobile Projects', error);
  }
}
