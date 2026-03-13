'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MonthHeroCardProps {
  monthLabel: string; // e.g. "March 2026"
  goal: number; // dollars
  confirmedPOValue: number;
  confirmedPOCount: number;
  verbalCommitValue: number;
  verbalCommitCount: number;
}

export function MonthHeroCard({
  monthLabel,
  goal,
  confirmedPOValue,
  confirmedPOCount,
  verbalCommitValue,
  verbalCommitCount,
}: MonthHeroCardProps) {
  const totalValue = confirmedPOValue + verbalCommitValue;
  const percentage = goal > 0 ? Math.round((totalValue / goal) * 100) : 0;
  const gap = totalValue - goal;

  // Color: green >= 100%, amber 70-99%, red < 70%
  const barColor =
    percentage >= 100
      ? 'bg-green-500'
      : percentage >= 70
        ? 'bg-amber-500'
        : 'bg-red-500';

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${v.toLocaleString()}`;
  };

  const GapIcon = gap > 0 ? TrendingUp : gap === 0 ? Minus : TrendingDown;

  const hasGoal = goal > 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {monthLabel}
          </h2>
          {hasGoal && (
            <div className="flex items-center gap-1.5 text-sm">
              <GapIcon className="h-3.5 w-3.5" />
              <span className={gap >= 0 ? 'text-green-600' : 'text-red-600'}>
                {gap >= 0 ? '+' : ''}{formatValue(Math.abs(gap))} {gap >= 0 ? 'over' : 'short'}
              </span>
            </div>
          )}
        </div>

        {/* Main progress */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-2xl font-bold">{formatValue(totalValue)}</span>
              {hasGoal && (
                <span className="text-muted-foreground"> of {formatValue(goal)} goal</span>
              )}
            </span>
            {hasGoal && <span className="text-muted-foreground">{percentage}%</span>}
          </div>
          {hasGoal && (
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Confirmed POs</p>
            <p className="text-lg font-semibold">{formatValue(confirmedPOValue)}</p>
            <p className="text-xs text-muted-foreground">{confirmedPOCount} deal{confirmedPOCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Verbal Commits</p>
            <p className="text-lg font-semibold">{formatValue(verbalCommitValue)}</p>
            <p className="text-xs text-muted-foreground">{verbalCommitCount} deal{verbalCommitCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
