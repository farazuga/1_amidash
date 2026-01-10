'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, RefreshCw, Unlink, ExternalLink, AlertCircle, RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CalendarConnection {
  id: string;
  provider: string;
  outlook_email: string | null;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}

interface SyncError {
  id: string;
  assignmentId: string;
  projectName: string;
  error: string;
  lastSyncedAt: string;
}

interface OutlookConnectionProps {
  connection: CalendarConnection | null;
  returnUrl?: string;
}

export function OutlookConnection({ connection, returnUrl = '/my-schedule' }: OutlookConnectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchSyncErrors = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/microsoft/errors');
      if (response.ok) {
        const data = await response.json();
        setSyncErrors(data.errors || []);
      }
    } catch (err) {
      console.error('Failed to fetch sync errors:', err);
    }
  }, []);

  // Fetch sync errors when connected
  useEffect(() => {
    if (connection) {
      fetchSyncErrors();
    }
  }, [connection, fetchSyncErrors]);

  const handleRetry = async (assignmentId: string) => {
    setRetryingId(assignmentId);
    try {
      const response = await fetch('/api/auth/microsoft/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });

      if (response.ok) {
        // Remove from error list on success
        setSyncErrors((prev) => prev.filter((e) => e.assignmentId !== assignmentId));
      } else {
        const data = await response.json();
        setError(data.error || 'Retry failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const handleConnect = () => {
    const url = `/api/auth/microsoft?return_url=${encodeURIComponent(returnUrl)}`;
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/microsoft/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect');
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch('/api/auth/microsoft/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setSyncResult({ synced: data.synced, failed: data.failed });
      // Refresh errors list after sync
      await fetchSyncErrors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle className="text-lg">Outlook Calendar</CardTitle>
          </div>
          {connection ? (
            <Badge variant="default" className="bg-green-600">Connected</Badge>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>
        <CardDescription>
          Sync your project assignments to Microsoft Outlook calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info note about which statuses sync */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <span className="font-medium">Note:</span> Only &quot;Pending Confirmation&quot; and &quot;Confirmed&quot; assignments sync to your Outlook calendar.
        </div>

        {connection ? (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connected account:</span>
                <span className="font-medium">{connection.outlook_email || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Connected on:</span>
                <span>{formatDate(connection.created_at)}</span>
              </div>
            </div>

            {syncResult && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                Synced {syncResult.synced} events
                {syncResult.failed > 0 && ` (${syncResult.failed} failed)`}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            {syncErrors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{syncErrors.length} sync error{syncErrors.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {syncErrors.map((syncErr) => (
                    <div
                      key={syncErr.id}
                      className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-950"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-amber-900 dark:text-amber-100 truncate">
                          {syncErr.projectName}
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 truncate">
                          {syncErr.error}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-800"
                        onClick={() => handleRetry(syncErr.assignmentId)}
                        disabled={retryingId === syncErr.assignmentId}
                      >
                        {retryingId === syncErr.assignmentId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3" />
                        )}
                        <span className="ml-1">Retry</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || isPending}
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting || isPending}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Outlook calendar to automatically sync your project assignments.
              Events will be created and updated when assignments change.
            </p>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            <Button onClick={handleConnect} className="w-full sm:w-auto">
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect Outlook Calendar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
