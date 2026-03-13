'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MonthSummary {
  key: string; // YYYY-MM
  label: string; // "March 2026"
  dealCount: number;
  value: number; // dollars
  goal: number | null; // null if no goal set
}

interface PipelineOutlookProps {
  months: MonthSummary[];
  unscheduled: { dealCount: number; value: number } | null;
  totalDeals: number;
  totalValue: number;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
  onMonthClick: (monthKey: string) => void;
}

export function PipelineOutlook({
  months,
  unscheduled,
  totalDeals,
  totalValue,
  allExpanded,
  onToggleExpandAll,
  onMonthClick,
}: PipelineOutlookProps) {
  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pipeline Outlook
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpandAll}
            className="gap-1 text-xs"
          >
            {allExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        </div>

        <div className="divide-y">
          {months.map((month) => {
            const pct = month.goal ? Math.round((month.value / month.goal) * 100) : null;
            return (
              <button
                key={month.key}
                onClick={() => onMonthClick(month.key)}
                className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-sm font-medium w-24 shrink-0">{month.label.split(' ')[0]}</span>
                <span className="text-xs text-muted-foreground w-16 shrink-0">
                  {month.dealCount} deal{month.dealCount !== 1 ? 's' : ''}
                </span>
                <span className="text-sm w-36 shrink-0">
                  {formatValue(month.value)}
                  {month.goal ? (
                    <span className="text-muted-foreground"> / {formatValue(month.goal)}</span>
                  ) : null}
                </span>
                {pct !== null ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground flex-1">{'\u2014'}</span>
                )}
              </button>
            );
          })}

          {unscheduled && (
            <button
              onClick={() => onMonthClick('unscheduled')}
              className="w-full px-4 py-2.5 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-sm font-medium w-24 shrink-0 italic text-muted-foreground">Unsched.</span>
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                {unscheduled.dealCount} deal{unscheduled.dealCount !== 1 ? 's' : ''}
              </span>
              <span className="text-sm">{formatValue(unscheduled.value)}</span>
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground">{'\u2014'}</span>
            </button>
          )}

          {/* Total row */}
          <div className="px-4 py-2.5 flex items-center gap-4 bg-muted/30">
            <span className="text-sm font-semibold w-24 shrink-0">Total</span>
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              {totalDeals} deal{totalDeals !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-semibold">{formatValue(totalValue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { MonthSummary };
