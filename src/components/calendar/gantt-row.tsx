'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { GanttBar } from './gantt-bar';
import { cn } from '@/lib/utils';
import type { GanttAssignment } from '@/types/calendar';

interface GanttRowProps {
  assignment: GanttAssignment;
  weekdayDates: Date[];
  totalDays: number;
  onStatusClick?: (assignmentId: string) => void;
  onEditClick?: (assignment: GanttAssignment) => void;
  isUpdating?: boolean;
}

export function GanttRow({
  assignment,
  weekdayDates,
  totalDays,
  onStatusClick,
  onEditClick,
  isUpdating,
}: GanttRowProps) {
  // Create a map of date string to column index for quick lookup
  const dateToColumnMap = useMemo(() => {
    const map = new Map<string, number>();
    weekdayDates.forEach((date, index) => {
      map.set(format(date, 'yyyy-MM-dd'), index + 1); // 1-based columns
    });
    return map;
  }, [weekdayDates]);

  // Calculate column positions for each block
  const blockPositions = useMemo(() => {
    return assignment.blocks
      .map((block) => {
        // Find the column for start and end dates
        const startCol = dateToColumnMap.get(block.startDate);
        const endCol = dateToColumnMap.get(block.endDate);

        // If block doesn't intersect with visible weekdays, skip
        if (startCol === undefined && endCol === undefined) {
          // Check if any days in the block are visible
          const blockDays = block.days || [];
          const visibleDays = blockDays.filter(d => dateToColumnMap.has(d.work_date));
          if (visibleDays.length === 0) return null;

          // Find min and max columns for visible days
          const cols = visibleDays.map(d => dateToColumnMap.get(d.work_date)!);
          return {
            block,
            startCol: Math.min(...cols),
            endCol: Math.max(...cols),
          };
        }

        return {
          block,
          startCol: startCol || 1,
          endCol: endCol || totalDays,
        };
      })
      .filter(Boolean) as { block: typeof assignment.blocks[0]; startCol: number; endCol: number }[];
  }, [assignment.blocks, dateToColumnMap, totalDays]);

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
          onEditClick={() => onEditClick?.(assignment)}
          isLoading={isUpdating}
        />
      ))}
    </div>
  );
}
