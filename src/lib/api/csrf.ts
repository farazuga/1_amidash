/**
 * Validate that the request Origin matches our app URL.
 * Returns a 403 Response if the origin doesn't match, or null if valid.
 */
export function validateOrigin(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const appOrigin = new URL(appUrl).origin;
  if (origin && origin !== appOrigin) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return null;
}
