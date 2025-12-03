import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const body = await request.json();
    const { to, clientName, projectId, newStatus, progressPercent } = body;

    if (!to || !clientName || !newStatus) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get the project's client token for the portal link
    // Note: In production, you'd fetch this from the database
    // For now, we'll use the projectId in the email

    const { data, error } = await resend.emails.send({
      from: 'Amitrace <updates@amitrace.com>',
      to: [to],
      subject: `Project Update: ${clientName} - ${newStatus}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8faf9;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <!-- Header -->
              <div style="background-color: #023A2D; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <img src="https://www.amitrace.com/wp-content/uploads/2022/04/amitrace-logo.png" alt="Amitrace" style="height: 40px; filter: brightness(0) invert(1);">
              </div>

              <!-- Content -->
              <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="color: #023A2D; font-size: 24px; margin: 0 0 10px 0;">
                  Project Status Update
                </h1>

                <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                  Your project <strong>${clientName}</strong> has been updated.
                </p>

                <!-- Status Badge -->
                <div style="text-align: center; margin: 30px 0;">
                  <span style="display: inline-block; background-color: #023A2D; color: white; padding: 12px 24px; border-radius: 50px; font-size: 18px; font-weight: 600;">
                    ${newStatus}
                  </span>
                </div>

                <!-- Progress Bar -->
                <div style="margin: 30px 0;">
                  <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">Project Progress</p>
                  <div style="background-color: #e5e7eb; border-radius: 9999px; height: 12px; overflow: hidden;">
                    <div style="background-color: #023A2D; height: 100%; width: ${progressPercent}%; border-radius: 9999px;"></div>
                  </div>
                  <p style="color: #023A2D; font-size: 14px; font-weight: 600; text-align: right; margin: 5px 0 0 0;">
                    ${progressPercent}% Complete
                  </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0 20px 0;">
                  <a href="${appUrl}" style="display: inline-block; background-color: #023A2D; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    View Full Status
                  </a>
                </div>

                <p style="color: #999; font-size: 14px; text-align: center; margin: 30px 0 0 0;">
                  Questions? Reply to this email or contact us at support@amitrace.com
                </p>
              </div>

              <!-- Footer -->
              <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} Amitrace. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
