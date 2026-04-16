import { createServiceClient } from '@/lib/supabase/server';

/**
 * Check if emails are enabled globally and optionally for a specific project.
 *
 * Safety-first: if any settings check fails due to a database/network error,
 * the corresponding flag defaults to `false` (don't send) rather than `true`.
 * This prevents unintended emails when the settings infrastructure is unreachable.
 *
 * @param projectId Optional project ID to check project-specific setting
 * @param recipientEmail Optional recipient email to check user-specific preference
 * @returns Object containing global, project, and user email enabled states
 */
export async function checkEmailEnabled(projectId?: string, recipientEmail?: string): Promise<{
  globalEnabled: boolean;
  projectEnabled: boolean;
  recipientEnabled: boolean;
  canSendEmail: boolean;
}> {
  // Use service client to bypass RLS — app_settings is admin-only,
  // but email checks run in the context of any authenticated user
  const supabase = await createServiceClient();

  // Default to enabled if settings don't exist (graceful degradation)
  let globalEnabled = true;
  let projectEnabled = true;
  let recipientEnabled = true;

  // Check global setting
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: setting, error } = await (supabase.from as any)('app_settings')
      .select('value')
      .eq('key', 'emails_enabled')
      .single();

    if (!error && setting) {
      globalEnabled = setting.value === true || setting.value === 'true';
    }
  } catch (error) {
    console.error('Failed to check global email settings:', error);
    // Default to disabled when settings cannot be verified (safety-first)
    globalEnabled = false;
  }

  // Check project-specific setting if projectId provided
  if (projectId) {
    try {
      // Query with raw select to handle missing column gracefully
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: project, error } = await (supabase.from('projects') as any)
        .select('email_notifications_enabled')
        .eq('id', projectId)
        .single();

      if (!error && project) {
        projectEnabled = project.email_notifications_enabled !== false;
      }
    } catch (error) {
      console.error('Failed to check project email settings:', error);
      // Default to disabled when settings cannot be verified (safety-first)
      projectEnabled = false;
    }
  }

  // Check recipient's email notification preference
  if (recipientEmail) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pref, error } = await (supabase.from as any)('email_notification_preferences')
        .select('notifications_enabled')
        .eq('email', recipientEmail.toLowerCase())
        .single();

      if (!error && pref) {
        recipientEnabled = pref.notifications_enabled !== false;
      }
      // If no preference exists (PGRST116 error), default to enabled
    } catch (error) {
      console.error('Failed to check recipient email preferences:', error);
      // Default to disabled when settings cannot be verified (safety-first)
      recipientEnabled = false;
    }
  }

  return {
    globalEnabled,
    projectEnabled,
    recipientEnabled,
    canSendEmail: globalEnabled && projectEnabled && recipientEnabled,
  };
}

/**
 * Get the global email enabled setting
 */
export async function getGlobalEmailEnabled(): Promise<boolean> {
  const { globalEnabled } = await checkEmailEnabled();
  return globalEnabled;
}
