'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, KeyRound, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TokenStatusSummary {
  total_connections: number;
  access_tokens: {
    valid: number;
    expiring_soon: number;
    expired: number;
  };
  refresh_tokens: {
    healthy: number;
    should_refresh_soon: number;
    at_risk: number;
  };
  checked_at: string;
}

export function TokenStatusSection() {
  const [tokenStatus, setTokenStatus] = useState<TokenStatusSummary | null>(null);
  const [tokenStatusLoading, setTokenStatusLoading] = useState(true);
  const [tokenStatusError, setTokenStatusError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokenStatus = async () => {
      setTokenStatusLoading(true);
      setTokenStatusError(null);
      try {
        const response = await fetch('/api/admin/token-status');
        if (!response.ok) {
          if (response.status === 403) {
            setTokenStatusError('Admin access required');
          } else {
            setTokenStatusError('Failed to load token status');
          }
          return;
        }
        const data = await response.json();
        setTokenStatus(data.summary);
      } catch (error) {
        console.error('Error fetching token status:', error);
        setTokenStatusError('Failed to load token status');
      } finally {
        setTokenStatusLoading(false);
      }
    };

    fetchTokenStatus();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Microsoft Token Status
        </CardTitle>
        <CardDescription>
          Monitor Microsoft authentication tokens for all users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokenStatusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tokenStatusError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{tokenStatusError}</AlertDescription>
          </Alert>
        ) : tokenStatus ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Access Tokens */}
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-3">Access Tokens</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valid</span>
                    <span className="text-sm font-medium text-green-600">{tokenStatus.access_tokens.valid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expiring Soon</span>
                    <span className="text-sm font-medium text-yellow-600">{tokenStatus.access_tokens.expiring_soon}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expired</span>
                    <span className="text-sm font-medium text-red-600">{tokenStatus.access_tokens.expired}</span>
                  </div>
                </div>
              </div>

              {/* Refresh Tokens */}
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-3">Refresh Tokens</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Healthy</span>
                    <span className="text-sm font-medium text-green-600">{tokenStatus.refresh_tokens.healthy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Refresh Soon</span>
                    <span className="text-sm font-medium text-yellow-600">{tokenStatus.refresh_tokens.should_refresh_soon}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">At Risk</span>
                    <span className="text-sm font-medium text-red-600">{tokenStatus.refresh_tokens.at_risk}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total and Warning */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total connections: <span className="font-medium text-foreground">{tokenStatus.total_connections}</span>
              </span>
              {(tokenStatus.refresh_tokens.at_risk > 0) && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {tokenStatus.refresh_tokens.at_risk} user{tokenStatus.refresh_tokens.at_risk !== 1 ? 's' : ''} may need to reconnect soon
                </span>
              )}
            </div>

            {/* View Details Link */}
            <div className="pt-2 border-t">
              <a
                href="/api/admin/token-status"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View Full Details
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No Microsoft connections found</p>
        )}

        <div className="text-xs text-muted-foreground border-t pt-4">
          <p><strong>Access tokens:</strong> Last ~1 hour, auto-refresh using refresh token</p>
          <p><strong>Refresh tokens:</strong> Last 90 days of inactivity, each use extends the window</p>
        </div>
      </CardContent>
    </Card>
  );
}
