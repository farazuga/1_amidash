'use client';

import { ExternalLink, DollarSign, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import type { ACDealDisplay } from '@/types/activecampaign';

function getEndOfNextMonth(): Date {
  const now = new Date();
  // Go to the 1st of 2 months ahead, then subtract 1 day
  const endOfNext = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  endOfNext.setHours(23, 59, 59, 999);
  return endOfNext;
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(num / 100);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function UpcomingDealsSegment() {
  const cutoffDate = getEndOfNextMonth();

  const { data: deals, isLoading } = useQuery({
    queryKey: ['activecampaign', 'deals', 'upcoming'],
    queryFn: async () => {
      const res = await fetch('/api/activecampaign/deals');
      if (!res.ok) throw new Error('Failed to fetch deals');
      const json = await res.json();
      return (json.deals || []) as ACDealDisplay[];
    },
    staleTime: 60 * 1000,
  });

  // Filter to deals with forecast close date <= end of next month
  const upcomingDeals = (deals || []).filter((deal) => {
    if (!deal.forecastCloseDate) return true; // Show deals without a date too
    const closeDate = new Date(deal.forecastCloseDate + 'T00:00:00');
    return closeDate <= cutoffDate;
  });

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <h4 className="font-semibold">Upcoming Deals</h4>
        <p className="text-sm text-muted-foreground">
          Verbal Commit deals closing through {cutoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      ) : upcomingDeals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No upcoming deals.</p>
      ) : (
        <div className="space-y-2">
          {upcomingDeals.map((deal) => (
            <div key={deal.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{deal.title}</p>
                  {deal.hasConfirmedPO ? (
                    <Badge variant="default" className="text-xs bg-green-600 shrink-0">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      PO
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs shrink-0">
                      <Circle className="mr-1 h-3 w-3" />
                      No PO
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {deal.accountName && <span>{deal.accountName}</span>}
                  {deal.contactName && <span>{deal.contactName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {deal.forecastCloseDate && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(deal.forecastCloseDate)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm font-medium">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(deal.value)}
                </span>
                {deal.dealUrl && (
                  <a href={deal.dealUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
