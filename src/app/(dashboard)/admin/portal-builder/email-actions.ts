'use server';

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { statusChangeEmail } from '@/lib/email/templates';
import type { PortalEmailTemplate, EmailStyleOverrides } from '@/types';

export async function getEmailTemplate(portalTemplateId: string): Promise<PortalEmailTemplate | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('portal_email_templates')
    .select('*')
    .eq('portal_template_id', portalTemplateId)
    .maybeSingle();
  return data;
}

export async function upsertEmailTemplate(
  portalTemplateId: string,
  updates: Partial<Omit<PortalEmailTemplate, 'id' | 'portal_template_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('portal_email_templates')
    .upsert({
      portal_template_id: portalTemplateId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'portal_template_id' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getEmailStyleForProject(projectId: string): Promise<EmailStyleOverrides | null> {
  const supabase = await createClient();
  // Resolve: project -> project_type -> portal_template -> portal_email_templates
  const { data: project } = await supabase
    .from('projects')
    .select('project_type_id')
    .eq('id', projectId)
    .single();

  if (!project?.project_type_id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projectType } = await (supabase as any)
    .from('project_types')
    .select('portal_template_id')
    .eq('id', project.project_type_id)
    .single();

  if (!projectType?.portal_template_id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emailTemplate } = await (supabase as any)
    .from('portal_email_templates')
    .select('*')
    .eq('portal_template_id', projectType.portal_template_id)
    .maybeSingle();

  if (!emailTemplate) return null;

  return {
    primaryColor: emailTemplate.primary_color,
    logoUrl: emailTemplate.logo_url,
    footerText: emailTemplate.footer_text,
    buttonColor: emailTemplate.button_color,
    buttonTextColor: emailTemplate.button_text_color,
  };
}

export async function sendTestEmail(portalTemplateId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get current user email
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { success: false, error: 'No user email found' };

  // Get email template overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: emailTemplate } = await (supabase as any)
    .from('portal_email_templates')
    .select('*')
    .eq('portal_template_id', portalTemplateId)
    .maybeSingle();

  const styleOverrides: EmailStyleOverrides | undefined = emailTemplate ? {
    primaryColor: emailTemplate.primary_color,
    logoUrl: emailTemplate.logo_url,
    footerText: emailTemplate.footer_text,
    buttonColor: emailTemplate.button_color,
    buttonTextColor: emailTemplate.button_text_color,
  } : undefined;

  // Build a sample status change email
  const html = statusChangeEmail({
    clientName: 'Sample Client',
    newStatus: 'Production',
    previousStatus: 'Engineering',
    portalUrl: 'https://dash.amitrace.com/status/sample-token',
    styleOverrides,
  });

  const result = await sendEmail({
    to: user.email,
    subject: '[TEST] Sample Status Update Email',
    html,
  });

  return result;
}
