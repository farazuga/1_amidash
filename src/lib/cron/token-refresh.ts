/**
 * Internal cron job to keep Microsoft tokens active
 *
 * This runs as a self-contained scheduled task within the app,
 * eliminating the need for external cron services or exposed endpoints.
 *
 * Schedule: Every 4 hours
 */

import cron from 'node-cron';
import { createServiceClient } from '@/lib/supabase/server';
import { getGraphClient } from '@/lib/microsoft-graph/client';
import { decryptToken, isEncryptionConfigured } from '@/lib/crypto';
import type { CalendarConnection } from '@/lib/microsoft-graph/types';

let isScheduled = false;

/**
 * Refresh tokens for all Microsoft connections
 */
async function keepTokensAlive(): Promise<void> {
  console.log('[Cron] Starting token keep-alive job...');

  try {
    const supabase = await createServiceClient();

    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('*');

    if (error) {
      console.error('[Cron] Failed to fetch connections:', error);
      return;
    }

    if (!connections || connections.length === 0) {
      console.log('[Cron] No connections to process');
      return;
    }

    console.log(`[Cron] Processing ${connections.length} connection(s)...`);

    let keptAlive = 0;
    let failed = 0;

    for (const conn of connections) {
      try {
        // Prepare connection with decrypted tokens
        let connection: CalendarConnection;

        if (isEncryptionConfigured()) {
          connection = {
            ...conn,
            access_token: decryptToken(conn.access_token),
            refresh_token: decryptToken(conn.refresh_token),
          } as CalendarConnection;
        } else {
          connection = conn as CalendarConnection;
        }

        // Get Graph client - this automatically refreshes the token if expired
        const { client } = await getGraphClient(connection);

        // Make a lightweight API call to keep the session active
        await client.api('/me').select('id').get();

        keptAlive++;
        console.log(`[Cron] Success for user ${conn.user_id}`);
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Cron] Failed for user ${conn.user_id}:`, errorMsg);
      }
    }

    console.log(`[Cron] Complete: ${keptAlive} kept alive, ${failed} failed`);
  } catch (err) {
    console.error('[Cron] Token keep-alive job failed:', err);
  }
}

/**
 * Initialize the cron scheduler
 * Call this once when the app starts
 */
export function initTokenRefreshCron(): void {
  // Prevent duplicate scheduling
  if (isScheduled) {
    console.log('[Cron] Token refresh cron already scheduled');
    return;
  }

  // Only run in production to avoid issues during development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Cron] Skipping cron setup in development');
    return;
  }

  // Schedule: Every 4 hours (at minute 0)
  // Cron expression: minute hour day-of-month month day-of-week
  cron.schedule('0 */4 * * *', () => {
    keepTokensAlive();
  });

  isScheduled = true;
  console.log('[Cron] Token refresh cron scheduled (every 4 hours)');

  // Also run once on startup (after a short delay to let the app fully initialize)
  setTimeout(() => {
    console.log('[Cron] Running initial token refresh...');
    keepTokensAlive();
  }, 10000); // 10 second delay
}

/**
 * Manually trigger token refresh (for testing/admin use)
 */
export { keepTokensAlive };
