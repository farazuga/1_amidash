'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  MessageSquare,
  Target,
} from 'lucide-react';

export interface BarSegment {
  label: string;
  value: number; // dollars
}

interface TargetTrackerCardProps {
  periodLabel: string;
  goal: number;
  receivedPOValue: number;
  receivedPOCount: number;
  verbalCommitValue: number;
  verbalCommitCount: number;
  receivedPOSegments?: BarSegment[];
  verbalCommitSegments?: BarSegment[];
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

// Alternating shades for distinguishing adjacent segments
const PO_SHADES = ['bg-green-500', 'bg-green-600'];
const VERBAL_SHADES = ['bg-amber-400', 'bg-amber-500'];

export function TargetTrackerCard({
  periodLabel,
  goal,
  receivedPOValue,
  receivedPOCount,
  verbalCommitValue,
  verbalCommitCount,
  receivedPOSegments,
  verbalCommitSegments,
}: TargetTrackerCardProps) {
  const totalValue = receivedPOValue + verbalCommitValue;
  const gap = goal - totalValue;
  const gapValue = Math.max(gap, 0);
  const goalMet = totalValue >= goal;

  const hasGoal = goal > 0;
  const poPercent = hasGoal ? Math.min((receivedPOValue / goal) * 100, 100) : 0;
  const verbalPercent = hasGoal
    ? Math.min((verbalCommitValue / goal) * 100, 100 - poPercent)
    : 0;

  const GapIcon = goalMet ? TrendingUp : gap === 0 ? Minus : TrendingDown;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {periodLabel}
          </h2>
          {hasGoal && (
            <div className="flex items-center gap-1.5 text-sm">
              <GapIcon className="h-3.5 w-3.5" />
              <span className={goalMet ? 'text-green-600' : 'text-red-600'}>
                {goalMet ? '+' : ''}
                {formatValue(Math.abs(gap))} {goalMet ? 'over' : 'short'}
              </span>
            </div>
          )}
        </div>

        {/* Big number + goal */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-2xl font-bold">{formatValue(totalValue)}</span>
              {hasGoal && (
                <span className="text-muted-foreground"> of {formatValue(goal)} goal</span>
              )}
            </span>
          </div>

          {/* Stacked progress bar — per-deal segments when available */}
          {hasGoal && (
            <div className="h-6 w-full rounded-full bg-muted overflow-hidden flex">
              {receivedPOSegments && receivedPOSegments.length > 0 ? (
                receivedPOSegments.map((seg, i) => {
                  const pct = (seg.value / goal) * 100;
                  if (pct <= 0) return null;
                  return (
                    <Tooltip key={`po-${i}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-full ${PO_SHADES[i % PO_SHADES.length]} transition-all border-r border-green-700/20 last:border-r-0 cursor-default`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{seg.label} — {formatValue(seg.value)}</TooltipContent>
                    </Tooltip>
                  );
                })
              ) : poPercent > 0 ? (
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${poPercent}%` }}
                />
              ) : null}
              {verbalCommitSegments && verbalCommitSegments.length > 0 ? (
                verbalCommitSegments.map((seg, i) => {
                  const pct = (seg.value / goal) * 100;
                  if (pct <= 0) return null;
                  return (
                    <Tooltip key={`vc-${i}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-full ${VERBAL_SHADES[i % VERBAL_SHADES.length]} transition-all border-r border-amber-700/20 last:border-r-0 cursor-default`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{seg.label} — {formatValue(seg.value)}</TooltipContent>
                    </Tooltip>
                  );
                })
              ) : verbalPercent > 0 ? (
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${verbalPercent}%` }}
                />
              ) : null}
            </div>
          )}

          {/* Legend */}
          {hasGoal && (
            <div className="flex gap-4 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                POs Received
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                Verbal Commits
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                Gap
              </div>
            </div>
          )}
        </div>

        {/* Stat cards grid */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {/* POs Received */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              POs Received
            </div>
            <p className="text-lg font-semibold">{formatValue(receivedPOValue)}</p>
            <p className="text-xs text-muted-foreground">
              {receivedPOCount} deal{receivedPOCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Verbal Commits */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
              Verbal Commits
            </div>
            <p className="text-lg font-semibold">{formatValue(verbalCommitValue)}</p>
            <p className="text-xs text-muted-foreground">
              {verbalCommitCount} deal{verbalCommitCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Gap to Goal */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              Gap to Goal
            </div>
            {goalMet ? (
              <p className="text-lg font-semibold text-green-600">Met!</p>
            ) : (
              <p className="text-lg font-semibold text-red-600">{formatValue(gapValue)}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { TargetTrackerCardProps };
