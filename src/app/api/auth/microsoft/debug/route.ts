/**
 * Debug endpoint to check Microsoft Graph token permissions
 * GET /api/auth/microsoft/debug
 *
 * TEMPORARY: Remove after confirming permissions work
 */

import { NextResponse } from 'next/server';
import { clearTokenCache, getAppAccessToken } from '@/lib/microsoft-graph/auth';

export async function GET() {
  try {
    // Always get a fresh token
    clearTokenCache();
    const token = await getAppAccessToken();

    // Decode JWT payload (middle part) without verification
    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid token format' });
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return NextResponse.json({
      tokenValid: true,
      roles: payload.roles || [],
      scopes: payload.scp || 'none (client_credentials)',
      audience: payload.aud,
      appId: payload.appid || payload.azp,
      tenantId: payload.tid,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      issuedAt: new Date(payload.iat * 1000).toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to get token',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
