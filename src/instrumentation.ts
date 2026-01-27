/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used to initialize background tasks like cron jobs.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (not during build or on client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTokenRefreshCron } = await import('@/lib/cron/token-refresh');
    initTokenRefreshCron();
  }
}
