/**
 * Token refresh cron job (DEPRECATED)
 *
 * With the switch to app-level client credentials, per-user token refresh
 * is no longer needed. The app-level token is cached in memory and
 * auto-refreshed by getAppAccessToken() in microsoft-graph/auth.ts.
 *
 * This module is kept as a no-op stub so that instrumentation.ts
 * doesn't break.
 */

/**
 * Initialize the cron scheduler (no-op with app-level credentials)
 */
export function initTokenRefreshCron(): void {
  console.log('[Cron] Token refresh cron not needed with app-level credentials');
}

/**
 * Manual trigger (no-op with app-level credentials)
 */
export async function keepTokensAlive(): Promise<void> {
  console.log('[Cron] Token keep-alive not needed with app-level credentials');
}
