import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, getPortalUrl } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, clientName, pocName, projectType, initialStatus, clientToken } = body;

    if (!to || !clientName || !pocName || !clientToken) {
      return NextResponse.json(
        { error: 'Missing required fields: to, clientName, pocName, clientToken' },
        { status: 400 }
      );
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
