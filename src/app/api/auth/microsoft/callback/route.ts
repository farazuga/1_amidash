/**
 * Microsoft OAuth callback route
 * GET /api/auth/microsoft/callback - Handles OAuth callback from Microsoft
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  exchangeCodeForTokens,
  calculateExpiresAt,
} from '@/lib/microsoft-graph/auth';
import { getUserInfo } from '@/lib/microsoft-graph/client';
import { fullSyncForUser } from '@/lib/microsoft-graph/sync';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('microsoft_oauth_state')?.value;
  const returnUrl = cookieStore.get('microsoft_oauth_return')?.value || '/my-schedule';

  // Clear OAuth cookies
  cookieStore.delete('microsoft_oauth_state');
  cookieStore.delete('microsoft_oauth_return');

  // Handle errors from Microsoft
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription);
    const url = new URL(returnUrl, request.nextUrl.origin);
    url.searchParams.set('outlook_error', errorDescription || error);
    return NextResponse.redirect(url);
  }

  // Verify state for CSRF protection
  if (!state || state !== storedState) {
    console.error('State mismatch:', { state, storedState });
    const url = new URL(returnUrl, request.nextUrl.origin);
    url.searchParams.set('outlook_error', 'Invalid state parameter');
    return NextResponse.redirect(url);
  }

  // Verify code is present
  if (!code) {
    const url = new URL(returnUrl, request.nextUrl.origin);
    url.searchParams.set('outlook_error', 'No authorization code received');
    return NextResponse.redirect(url);
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL('/login', request.nextUrl.origin);
    url.searchParams.set('redirect', returnUrl);
    return NextResponse.redirect(url);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info from Microsoft to display connected email
    const msUserInfo = await getUserInfo(tokens.access_token);

    // Store connection in database using service client (bypass RLS for insert)
    const serviceClient = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await (serviceClient as any).from('calendar_connections').upsert(
      {
        user_id: user.id,
        provider: 'microsoft',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: calculateExpiresAt(tokens.expires_in).toISOString(),
        outlook_email: msUserInfo.mail || msUserInfo.userPrincipalName,
        calendar_id: 'primary',
      },
      {
        onConflict: 'user_id,provider',
      }
    );

    if (dbError) {
      console.error('Failed to store calendar connection:', dbError);
      const url = new URL(returnUrl, request.nextUrl.origin);
      url.searchParams.set('outlook_error', 'Failed to save connection');
      return NextResponse.redirect(url);
    }

    // Trigger initial sync in the background
    // Don't wait for it to complete
    fullSyncForUser(user.id).catch((err) => {
      console.error('Initial sync failed:', err);
    });

    // Redirect with success
    const url = new URL(returnUrl, request.nextUrl.origin);
    url.searchParams.set('outlook_connected', 'true');
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('Microsoft OAuth callback error:', err);
    const url = new URL(returnUrl, request.nextUrl.origin);
    url.searchParams.set(
      'outlook_error',
      err instanceof Error ? err.message : 'Failed to connect'
    );
    return NextResponse.redirect(url);
  }
}
