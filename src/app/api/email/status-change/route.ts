import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, getPortalUrl } from '@/lib/email/send';
import { statusChangeEmail } from '@/lib/email/templates';
import { createClient } from '@/lib/supabase/server';
import { statusChangeEmailSchema } from '@/lib/validation';

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
    const parseResult = statusChangeEmailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { to, clientName, newStatus, previousStatus, clientToken, note } = parseResult.data;

    const portalUrl = clientToken ? getPortalUrl(clientToken) : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

    const html = statusChangeEmail({
      clientName,
      newStatus,
      previousStatus,
      portalUrl,
      note,
    });

    const result = await sendEmail({
      to,
      subject: `Project Update: ${clientName} - ${newStatus}`,
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
