'use client';

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useUndoStore, type UndoAction } from '@/stores/undo-store';
import { useAddAssignmentDays, useRemoveAssignmentDays, useMoveAssignmentDay } from '@/hooks/queries/use-assignments';

/**
 * Hook that handles undo functionality
 * - Listens for Cmd+Z (Mac) / Ctrl+Z (Windows) keyboard shortcut
 * - Executes the appropriate undo operation based on the action type
 */
export function useUndo() {
  const { popAction, peekAction, canUndo, setIsUndoing, isUndoing } = useUndoStore();

  const addDays = useAddAssignmentDays();
  const removeDays = useRemoveAssignmentDays();
  const moveDays = useMoveAssignmentDay();

  const executeUndo = useCallback(async () => {
    if (!canUndo() || isUndoing) return;

    const action = popAction();
    if (!action) return;

    setIsUndoing(true);

    try {
      switch (action.type) {
        case 'add-day':
        case 'copy-day':
          // Undo add/copy = remove the day
          await removeDays.mutateAsync([action.data.dayId]);
          toast.success('Undo successful', {
            description: `Removed ${action.data.userName} from ${formatDate(action.data.date)}`,
          });
          break;

        case 'remove-day':
          // Undo remove = add the day back
          await addDays.mutateAsync({
            assignmentId: action.data.assignmentId,
            days: [{
              date: action.data.date,
              startTime: action.data.startTime,
              endTime: action.data.endTime,
            }],
          });
          toast.success('Undo successful', {
            description: `Restored ${action.data.userName} on ${formatDate(action.data.date)}`,
          });
          break;

        case 'move-day':
          // Undo move = move back to original date
          await moveDays.mutateAsync({
            dayId: action.data.dayId,
            newDate: action.data.originalDate,
          });
          toast.success('Undo successful', {
            description: `Moved ${action.data.userName} back to ${formatDate(action.data.originalDate)}`,
          });
          break;

        case 'status-change':
          // Status change undo would require additional mutation
          // For now, show a message that it can't be undone
          toast.info('Status change undo not yet supported', {
            description: 'Use the status selector to change back manually',
          });
          break;
      }
    } catch (error) {
      toast.error('Undo failed', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsUndoing(false);
    }
  }, [canUndo, isUndoing, popAction, setIsUndoing, addDays, removeDays, moveDays]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z (Mac) or Ctrl+Z (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Don't undo if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        e.preventDefault();
        executeUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeUndo]);

  return {
    canUndo,
    executeUndo,
    isUndoing,
    peekAction,
  };
}

/**
 * Format a date string for display in toast messages
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
