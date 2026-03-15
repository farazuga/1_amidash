// src/lib/microsoft-graph/auth.ts
// App-level client credentials flow for Microsoft Graph API
// No per-user OAuth needed — single app registration with admin consent

const TENANT_ID = process.env.MICROSOFT_TENANT_ID!;
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const APP_SCOPES = 'https://graph.microsoft.com/.default';

// Cache token in memory (server-side singleton)
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  // Return cached token if still valid (5-min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: APP_SCOPES,
    grant_type: 'client_credentials',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get app token: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// For testing: clear cached token
export function clearTokenCache() {
  cachedToken = null;
}
