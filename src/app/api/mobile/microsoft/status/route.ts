/**
 * Mobile API endpoint to check Microsoft connection status
 *
 * With app-level credentials, Microsoft is always "connected" if env vars are set.
 * Individual users no longer need to connect their own accounts.
 */
export async function GET() {
  const configured = !!(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_TENANT_ID
  );

  return Response.json({
    connected: configured,
    email: null,
    expires_at: null,
  });
}
