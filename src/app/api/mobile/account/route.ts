import { createClient } from '@supabase/supabase-js';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { internalError } from '@/lib/api/error-response';

/**
 * DELETE /api/mobile/account
 *
 * Self-service account deletion for mobile users.
 * Required by Apple App Store Review Guideline 5.1.1(v).
 *
 * Deletes the authenticated user's Supabase Auth account.
 * Cascading deletes handle: profiles, saved_filters, user_availability.
 * Other tables referencing user_id will retain rows with dangling FKs
 * (project_files.uploaded_by, status_history.changed_by, etc.) to preserve
 * audit trail integrity.
 */
export async function DELETE(request: Request) {
  try {
    const authResult = await authenticateMobileRequest(request);
    if (authResult instanceof Response) return authResult;
    const { user, profile } = authResult;

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Log the deletion before removing the user (audit_logs.user_id is SET NULL on cascade)
    await serviceClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'account_self_deleted',
      field_name: 'user',
      old_value: user.email ?? 'unknown',
    });

    // Delete the user from Supabase Auth
    // ON DELETE CASCADE removes: profiles, saved_filters, user_availability
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.error('[Mobile Account Delete] Supabase auth deletion failed:', deleteError);
      return Response.json(
        { error: 'Account deletion failed. Please try again.' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return internalError('Mobile Account Delete', error);
  }
}
