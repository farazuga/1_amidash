'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

const SLIP_THRESHOLD_DAYS = 14;
const MAX_DISPLAY = 10;

interface SlippedDealsCalloutProps {
  deals: ACDealDisplay[];
}

export function SlippedDealsCallout({ deals }: SlippedDealsCalloutProps) {
  const today = new Date();

  const slippedDeals = deals
    .filter((d) => {
      if (!d.forecastCloseDate) return false;
      const closeDate = parseISO(d.forecastCloseDate);
      return differenceInDays(today, closeDate) > SLIP_THRESHOLD_DAYS;
    })
    .map((d) => ({
      ...d,
      daysOverdue: differenceInDays(today, parseISO(d.forecastCloseDate)),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (slippedDeals.length === 0) return null;

  const totalValue = slippedDeals.reduce((sum, d) => sum + parseInt(d.value, 10) / 100, 0);
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  const displayed = slippedDeals.slice(0, MAX_DISPLAY);
  const hasMore = slippedDeals.length > MAX_DISPLAY;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Slipped Deals ({slippedDeals.length} deal{slippedDeals.length !== 1 ? 's' : ''}, {formatValue(totalValue)})
        </div>
        <table className="w-full text-sm">
          <tbody>
            {displayed.map((deal) => (
              <tr key={deal.id} className="border-b border-amber-200/50 last:border-0">
                <td className="py-1.5 pr-3">
                  <a
                    href={deal.dealUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {deal.title}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">{deal.accountName || '\u2014'}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {format(parseISO(deal.forecastCloseDate), 'MMM d')}
                </td>
                <td className="py-1.5 pr-3 text-amber-600 font-medium">{deal.daysOverdue}d late</td>
                <td className="py-1.5 text-right">{formatValue(parseInt(deal.value, 10) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <p className="text-xs text-muted-foreground">
            + {slippedDeals.length - MAX_DISPLAY} more slipped deals
          </p>
        )}
      </CardContent>
    </Card>
  );
}
