'use client';

import { useScorecard } from '@/hooks/queries/use-l10-scorecard';
import { useCreateIssue } from '@/hooks/queries/use-l10-issues';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GoalDirection, ScorecardEntry } from '@/types/l10';

function getLast13Weeks(): string[] {
  const weeks: string[] = [];
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  for (let i = 12; i >= 0; i--) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - i * 7);
    weeks.push(d.toISOString().split('T')[0]);
  }
  return weeks;
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOnTrack(value: number | null, goal: number | null, direction: GoalDirection): boolean | null {
  if (value === null || goal === null) return null;
  if (direction === 'above') return value >= goal;
  if (direction === 'below') return value <= goal;
  return value === goal;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  if (unit === 'currency') return `$${value.toLocaleString()}`;
  if (unit === 'percentage') return `${value}%`;
  return value.toLocaleString();
}

interface ScorecardSegmentProps {
  teamId: string;
}

export function ScorecardSegment({ teamId }: ScorecardSegmentProps) {
  const { data: scorecardData, isLoading } = useScorecard(teamId);
  const createIssue = useCreateIssue();
  const weeks = getLast13Weeks();

  const handleDropToIssue = async (measurableTitle: string, measurableId: string) => {
    try {
      await createIssue.mutateAsync({
        teamId,
        title: `Scorecard: ${measurableTitle} off track`,
        sourceType: 'scorecard',
        sourceId: measurableId,
      });
      toast.success('Added to Issues');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  const measurables = scorecardData?.measurables || [];
  const entries = scorecardData?.entries || [];

  const entryMap = new Map<string, Map<string, ScorecardEntry>>();
  for (const entry of entries) {
    if (!entryMap.has(entry.measurable_id)) {
      entryMap.set(entry.measurable_id, new Map());
    }
    entryMap.get(entry.measurable_id)!.set(entry.week_of, entry);
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <h4 className="font-semibold">Scorecard Review</h4>
        <p className="text-sm text-muted-foreground">Review weekly metrics. Drop off-track items to Issues.</p>
      </div>

      {measurables.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No measurables configured. Add them in the Scorecard tab.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium min-w-[160px]">Measurable</th>
                <th className="px-3 py-2 text-right font-medium w-16">Goal</th>
                {weeks.slice(-4).map((week) => (
                  <th key={week} className="px-2 py-2 text-center font-medium w-16 text-xs">{formatWeek(week)}</th>
                ))}
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {measurables.map((m) => {
                const mEntries = entryMap.get(m.id) || new Map();
                const lastWeek = weeks[weeks.length - 1];
                const lastEntry = mEntries.get(lastWeek);
                const lastOnTrack = isOnTrack(lastEntry?.value ?? null, m.goal_value, m.goal_direction);

                return (
                  <tr key={m.id} className="border-b">
                    <td className="sticky left-0 bg-background px-3 py-2 font-medium">{m.title}</td>
                    <td className="px-3 py-2 text-right text-xs">{m.goal_value !== null ? formatValue(m.goal_value, m.unit) : '—'}</td>
                    {weeks.slice(-4).map((week) => {
                      const entry = mEntries.get(week);
                      const val = entry?.value ?? null;
                      const onTrack = isOnTrack(val, m.goal_value, m.goal_direction);
                      return (
                        <td key={week} className="px-2 py-2 text-center">
                          <span className={cn(
                            'inline-block rounded px-2 py-0.5 text-xs',
                            onTrack === true && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                            onTrack === false && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                          )}>
                            {formatValue(val, m.unit)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2">
                      {lastOnTrack === false && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDropToIssue(m.title, m.id)} title="Drop to Issues">
                          <ArrowRightLeft className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
