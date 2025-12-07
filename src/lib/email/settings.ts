import { createClient } from '@/lib/supabase/server';

/**
 * Check if emails are enabled globally and optionally for a specific project
 * @param projectId Optional project ID to check project-specific setting
 * @returns Object containing global and project email enabled states
 */
export async function checkEmailEnabled(projectId?: string): Promise<{
  globalEnabled: boolean;
  projectEnabled: boolean;
  canSendEmail: boolean;
}> {
  const supabase = await createClient();

  // Default to enabled if settings don't exist (graceful degradation)
  let globalEnabled = true;
  let projectEnabled = true;

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
  } catch {
    // Table might not exist yet - default to enabled
    globalEnabled = true;
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
    } catch {
      // Column might not exist yet - default to enabled
      projectEnabled = true;
    }
  }

  return {
    globalEnabled,
    projectEnabled,
    canSendEmail: globalEnabled && projectEnabled,
  };
}

/**
 * Get the global email enabled setting
 */
export async function getGlobalEmailEnabled(): Promise<boolean> {
  const { globalEnabled } = await checkEmailEnabled();
  return globalEnabled;
}
