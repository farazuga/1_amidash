/**
 * Validate that the request Origin matches our app URL.
 * Returns a 403 Response if the origin doesn't match, or null if valid.
 *
 * Rejects requests with no Origin header (CSRF bypass vector).
 * Mobile API routes use Bearer token auth and should NOT use this function.
 */
export function validateOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const appOrigin = new URL(appUrl).origin;

  // Require Origin header on all state-changing requests
  if (!origin) {
    return Response.json({ error: 'Missing origin header' }, { status: 403 });
  }

  if (origin !== appOrigin) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  }

  return null;
}
