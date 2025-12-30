/**
 * Microsoft OAuth authentication helpers
 */

import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import type { MicrosoftTokenResponse, MicrosoftOAuthConfig } from './types';

// OAuth configuration
const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Calendars.ReadWrite',
  'User.Read',
];

function getConfig(): MicrosoftOAuthConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  // Debug logging - remove after troubleshooting
  console.log('[Microsoft OAuth Config]', {
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET',
    redirectUri: redirectUri || 'NOT SET',
    tenantId: tenantId,
  });

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Microsoft OAuth configuration. Please set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI environment variables.'
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    tenantId,
    scopes: MICROSOFT_SCOPES,
  };
}

function getMsalClient(): ConfidentialClientApplication {
  const config = getConfig();

  const msalConfig: Configuration = {
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  };

  return new ConfidentialClientApplication(msalConfig);
}

/**
 * Check if Microsoft OAuth is configured
 */
export function isMicrosoftConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_REDIRECT_URI
  );
}

/**
 * Generate the Microsoft OAuth authorization URL
 */
export function getAuthUrl(state: string): string {
  const config = getConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: config.scopes.join(' '),
    state,
    prompt: 'consent', // Force consent to get refresh token
  });

  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<MicrosoftTokenResponse> {
  const config = getConfig();
  const msalClient = getMsalClient();

  try {
    const response = await msalClient.acquireTokenByCode({
      code,
      scopes: config.scopes,
      redirectUri: config.redirectUri,
    });

    if (!response || !response.accessToken) {
      throw new Error('Failed to acquire tokens from Microsoft');
    }

    // MSAL doesn't directly return refresh_token in the response object
    // We need to handle this differently - the token is cached internally
    // For server-side, we'll use the token endpoint directly

    return await exchangeCodeDirectly(code);
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

/**
 * Direct token exchange using fetch (more control over response)
 */
async function exchangeCodeDirectly(code: string): Promise<MicrosoftTokenResponse> {
  const config = getConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    scope: config.scopes.join(' '),
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Token exchange failed:', errorData);
    throw new Error(errorData.error_description || 'Failed to exchange code for tokens');
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<MicrosoftTokenResponse> {
  const config = getConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: config.scopes.join(' '),
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Token refresh failed:', errorData);
    throw new Error(errorData.error_description || 'Failed to refresh token');
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken, // Keep old if not returned
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Generate a random state string for CSRF protection
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate token expiration timestamp
 */
export function calculateExpiresAt(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Check if a token is expired (with 5 minute buffer)
 */
export function isTokenExpired(expiresAt: Date | string): boolean {
  const expirationTime = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= expirationTime.getTime() - bufferMs;
}
