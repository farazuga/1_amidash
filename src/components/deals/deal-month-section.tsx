'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, ExternalLink, Camera } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import type { ACDealDisplay } from '@/types/activecampaign';

interface DealMonthSectionProps {
  label: string; // "March 2026" or "Unscheduled"
  deals: ACDealDisplay[];
  totalValue: number;
  isOpen: boolean;
  onToggle: () => void;
  fileCounts: Record<string, number>;
}

export function DealMonthSection({ label, deals, totalValue, isOpen, onToggle, fileCounts }: DealMonthSectionProps) {
  const formatValue = (cents: string) => {
    const dollars = parseInt(cents, 10) / 100;
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
    return `$${dollars.toLocaleString()}`;
  };

  const formatTotal = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-2">
              <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <span className="font-medium">{label}</span>
              <span className="text-sm text-muted-foreground">
                {deals.length} deal{deals.length !== 1 ? 's' : ''} &middot; {formatTotal(totalValue)}
              </span>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-t border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium text-center">Photos</th>
                  <th className="px-4 py-2 font-medium text-right">Value</th>
                  <th className="px-4 py-2 font-medium text-right">Close Date</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <a
                        href={deal.dealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        {deal.title}
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-sm">{deal.accountName || '\u2014'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {fileCounts[deal.id] > 0 ? (
                        <Link
                          href={`/presales-files/${deal.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Camera className="h-3.5 w-3.5 shrink-0" />
                          <span>{fileCounts[deal.id]}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right">{formatValue(deal.value)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-muted-foreground">
                      {deal.forecastCloseDate
                        ? format(parseISO(deal.forecastCloseDate), 'MMM d')
                        : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
