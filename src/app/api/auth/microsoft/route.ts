/**
 * Microsoft OAuth initiation route
 * GET /api/auth/microsoft - Redirects to Microsoft login
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAuthUrl, generateState, isMicrosoftConfigured } from '@/lib/microsoft-graph/auth';

export async function GET(request: NextRequest) {
  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if Microsoft OAuth is configured
  if (!isMicrosoftConfigured()) {
    return NextResponse.json(
      { error: 'Microsoft OAuth is not configured' },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = generateState();

  // Store state in cookie for verification in callback
  const cookieStore = await cookies();
  cookieStore.set('microsoft_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Store return URL if provided
  const returnUrl = request.nextUrl.searchParams.get('return_url');
  if (returnUrl) {
    cookieStore.set('microsoft_oauth_return', returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
  }

  // Redirect to Microsoft OAuth
  const authUrl = getAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
