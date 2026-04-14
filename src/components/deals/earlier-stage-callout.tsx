'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowUpRight, ChevronRight, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ACDealDisplay } from '@/types/activecampaign';

interface EarlierStageCalloutProps {
  deals: ACDealDisplay[];        // All-stage deals
  currentMonthKey: string;       // "2026-04"
  verbalCommitStageName?: string; // "Verbal Commit"
}

export function EarlierStageCallout({
  deals,
  currentMonthKey,
  verbalCommitStageName = 'Verbal Commit',
}: EarlierStageCalloutProps) {
  const [isOpen, setIsOpen] = useState(false);

  const earlierDeals = deals.filter((d) => {
    if (!d.forecastCloseDate) return false;
    if (d.stageName?.toLowerCase() === verbalCommitStageName.toLowerCase()) return false;
    return d.forecastCloseDate.startsWith(currentMonthKey);
  });

  if (earlierDeals.length === 0) return null;

  const totalValue = earlierDeals.reduce((sum, d) => sum + parseInt(d.value, 10) / 100, 0);
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardContent className="p-4 flex items-center gap-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {earlierDeals.length} deal{earlierDeals.length !== 1 ? 's' : ''} ({formatValue(totalValue)}) in earlier stages need to reach Verbal Commit
              </span>
              <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </CardContent>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-1.5 font-medium">Deal</th>
                  <th className="pb-1.5 font-medium">Stage</th>
                  <th className="pb-1.5 font-medium">Account</th>
                  <th className="pb-1.5 font-medium text-right">Value</th>
                  <th className="pb-1.5 font-medium text-right">Close</th>
                </tr>
              </thead>
              <tbody>
                {earlierDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-blue-200/50 last:border-0">
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
                    <td className="py-1.5 pr-3 text-muted-foreground">{deal.stageName}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{deal.accountName || '\u2014'}</td>
                    <td className="py-1.5 pr-3 text-right">{formatValue(parseInt(deal.value, 10) / 100)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {format(parseISO(deal.forecastCloseDate), 'MMM d')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
