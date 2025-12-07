import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, getPortalUrl } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';
import { createClient } from '@/lib/supabase/server';
import { welcomeEmailSchema } from '@/lib/validation';
import { getGlobalEmailEnabled } from '@/lib/email/settings';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection - validate request origin
    const origin = request.headers.get('origin');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const appOrigin = new URL(appUrl).origin;
    if (origin && origin !== appOrigin) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Zod validation
    const parseResult = welcomeEmailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { to, clientName, pocName, projectType, initialStatus, clientToken } = parseResult.data;

    // Check if emails are enabled globally
    const globalEnabled = await getGlobalEmailEnabled();
    if (!globalEnabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Client emails are disabled globally',
      });
    }

    const portalUrl = getPortalUrl(clientToken);

    const html = welcomeEmail({
      clientName,
      pocName,
      projectType: projectType || 'Project',
      initialStatus: initialStatus || 'Started',
      portalUrl,
    });

    const result = await sendEmail({
      to,
      subject: `Welcome to Amitrace - ${clientName}`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
