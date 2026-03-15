/**
 * Microsoft OAuth initiation route (DEPRECATED)
 *
 * With the switch to app-level client credentials, per-user OAuth is no longer needed.
 * This route is kept as a stub for backwards compatibility - it returns
 * a clear message that per-user Microsoft login is no longer required.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Per-user Microsoft login is no longer required. The app uses app-level credentials.',
    },
    { status: 410 } // 410 Gone
  );
}
