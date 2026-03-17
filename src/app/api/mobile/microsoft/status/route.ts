import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { internalError } from '@/lib/api/error-response';

/**
 * Mobile API endpoint to check Microsoft connection status
 *
 * With app-level client credentials, this now returns connected: true
 * if the server has Microsoft env vars configured (no per-user connection needed).
 *
 * Response shape is unchanged for backwards compatibility:
 * - connected: boolean
 * - email: string | null (always null with app-level auth)
 * - expires_at: string | null (always null with app-level auth)
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize (staff only)
    const authResult = await authenticateMobileRequest(request);
    if (authResult instanceof Response) return authResult;

    // 2. Check if Microsoft is configured at the app level
    const connected = !!(
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_TENANT_ID
    );

    return Response.json({
      connected,
      email: null,
      expires_at: null,
    });
  } catch (error) {
    return internalError('Mobile MS Status', error);
  }
}
