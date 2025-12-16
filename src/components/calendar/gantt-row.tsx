'use client';

import { useMemo } from 'react';
import { GanttBar } from './gantt-bar';
import { cn } from '@/lib/utils';
import type { GanttAssignment } from '@/types/calendar';

interface GanttRowProps {
  assignment: GanttAssignment;
  viewStartDate: Date;
  viewEndDate: Date;
  totalDays: number;
  onStatusClick?: (assignmentId: string) => void;
  isUpdating?: boolean;
}

export function GanttRow({
  assignment,
  viewStartDate,
  viewEndDate,
  totalDays,
  onStatusClick,
  isUpdating,
}: GanttRowProps) {
  // Calculate column positions for each block
  const blockPositions = useMemo(() => {
    const viewStart = viewStartDate.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    return assignment.blocks
      .map((block) => {
        const blockStart = new Date(block.startDate + 'T00:00:00').getTime();
        const blockEnd = new Date(block.endDate + 'T00:00:00').getTime();

        // Calculate 1-based column positions
        const startCol = Math.floor((blockStart - viewStart) / msPerDay) + 1;
        const endCol = Math.floor((blockEnd - viewStart) / msPerDay) + 1;

        // Check if block is visible in the view
        if (endCol < 1 || startCol > totalDays) {
          return null;
        }

        // Clamp to view bounds
        return {
          block,
          startCol: Math.max(1, startCol),
          endCol: Math.min(totalDays, endCol),
        };
      })
      .filter(Boolean) as { block: typeof assignment.blocks[0]; startCol: number; endCol: number }[];
  }, [assignment.blocks, viewStartDate, totalDays]);

  if (blockPositions.length === 0) {
    return null;
  }

  return (
    <div
      className="relative grid h-10"
      style={{
        gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))`,
      }}
    >
      {/* Day grid lines (background) */}
      {Array.from({ length: totalDays }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'border-r border-border/50',
            i === totalDays - 1 && 'border-r-0'
          )}
        />
      ))}

      {/* Assignment bars */}
      {blockPositions.map((pos, idx) => (
        <GanttBar
          key={`${assignment.assignmentId}-${idx}`}
          assignmentId={assignment.assignmentId}
          userName={assignment.userName}
          bookingStatus={assignment.bookingStatus}
          block={pos.block}
          startColumn={pos.startCol}
          endColumn={pos.endCol}
          onClick={() => onStatusClick?.(assignment.assignmentId)}
          isLoading={isUpdating}
        />
      ))}
    </div>
  );
}
