'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowRightLeft } from 'lucide-react';
import { useRocks, useToggleRockStatus, useDropRockToIssue } from '@/hooks/queries/use-l10-rocks';
import { toast } from 'sonner';
import type { RockStatus, RockMilestone, RockWithOwner } from '@/types/l10';
import { cn } from '@/lib/utils';
import { RockDetailSheet } from '../rock-detail-sheet';

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

interface RockReviewSegmentProps {
  teamId: string;
}

export function RockReviewSegment({ teamId }: RockReviewSegmentProps) {
  const quarter = getCurrentQuarter();
  const { data: rocks, isLoading } = useRocks(teamId, quarter);
  const toggleStatus = useToggleRockStatus();
  const dropToIssue = useDropRockToIssue();
  const [selectedRock, setSelectedRock] = useState<RockWithOwner | null>(null);

  const handleToggle = async (id: string) => {
    try {
      await toggleStatus.mutateAsync(id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDrop = async (id: string, title: string) => {
    try {
      await dropToIssue.mutateAsync(id);
      toast.success(`"${title}" added to Issues`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-md bg-muted" />;
  }

  const statusColors: Record<RockStatus, string> = {
    on_track: 'bg-green-600 hover:bg-green-700',
    off_track: 'bg-red-600 hover:bg-red-700',
    complete: 'bg-blue-600',
    dropped: 'bg-gray-400',
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <h4 className="font-semibold">Rock Review ({quarter})</h4>
        <p className="text-sm text-muted-foreground">Update status of each rock. Click status to toggle.</p>
      </div>

      {!rocks || rocks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No rocks for this quarter.</p>
      ) : (
        <div className="space-y-2">
          {rocks.map((rock) => {
            const milestones = (rock.milestones || []) as RockMilestone[];
            const total = milestones.length;
            const complete = milestones.filter((m) => m.is_complete).length;
            const progressValue = total > 0 ? (complete / total) * 100 : 0;

            return (
              <div key={rock.id} className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/30" onClick={() => setSelectedRock(rock)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{rock.title}</p>
                  <p className="text-xs text-muted-foreground">{rock.profiles?.full_name || '-'}</p>
                  {total > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={progressValue} className="h-1.5 w-24" />
                      <span className="text-xs text-muted-foreground">{complete}/{total}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn('cursor-pointer text-white', statusColors[rock.status])}
                    onClick={(e) => { e.stopPropagation(); handleToggle(rock.id); }}
                  >
                    {rock.status.replace('_', ' ')}
                  </Badge>
                  {rock.status === 'off_track' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDrop(rock.id, rock.title); }} title="Drop to Issues">
                      <ArrowRightLeft className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RockDetailSheet rock={selectedRock} onClose={() => setSelectedRock(null)} teamId={teamId} />
    </div>
  );
}
