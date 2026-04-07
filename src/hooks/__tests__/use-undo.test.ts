// src/hooks/__tests__/use-undo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUndoStore, type UndoAction } from '@/stores/undo-store';

/**
 * Tests for the undo store (which backs the useUndo hook).
 * The useUndo hook itself is an orchestration layer over mutations;
 * the stack logic lives in useUndoStore.
 */

function makeAction(
  overrides: Partial<Omit<UndoAction, 'timestamp'>> = {},
): Omit<UndoAction, 'timestamp'> {
  return {
    type: 'add-day',
    description: 'Test action',
    data: {
      assignmentId: 'a1',
      dayId: 'd1',
      date: '2026-03-17',
      userName: 'Alice',
    },
    ...overrides,
  } as Omit<UndoAction, 'timestamp'>;
}

describe('useUndoStore', () => {
  beforeEach(() => {
    // Reset store between tests
    const store = useUndoStore.getState();
    store.clearStack();
    store.setIsUndoing(false);
  });

  describe('pushAction', () => {
    it('adds an action to the stack', () => {
      const { pushAction } = useUndoStore.getState();

      act(() => {
        pushAction(makeAction());
      });

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(1);
      expect(undoStack[0].type).toBe('add-day');
      expect(undoStack[0].timestamp).toBeTypeOf('number');
    });

    it('pushes most recent action to the front', () => {
      const { pushAction } = useUndoStore.getState();

      act(() => {
        pushAction(makeAction({ description: 'first' }));
        pushAction(makeAction({ description: 'second' }));
      });

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(2);
      expect(undoStack[0].description).toBe('second');
      expect(undoStack[1].description).toBe('first');
    });

    it('does not push while isUndoing is true', () => {
      const store = useUndoStore.getState();

      act(() => {
        store.setIsUndoing(true);
        store.pushAction(makeAction());
      });

      expect(useUndoStore.getState().undoStack).toHaveLength(0);
    });

    it('enforces maxStackSize by dropping oldest items', () => {
      const { pushAction } = useUndoStore.getState();
      const maxSize = useUndoStore.getState().maxStackSize; // 10

      act(() => {
        for (let i = 0; i < maxSize + 5; i++) {
          pushAction(makeAction({ description: `action-${i}` }));
        }
      });

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(maxSize);
      // Most recent should be the last pushed
      expect(undoStack[0].description).toBe(`action-${maxSize + 4}`);
      // Oldest kept should be action at index (maxSize + 5 - maxSize) = 5
      expect(undoStack[maxSize - 1].description).toBe('action-5');
    });
  });

  describe('popAction', () => {
    it('returns undefined when stack is empty', () => {
      const { popAction } = useUndoStore.getState();

      let result: UndoAction | undefined;
      act(() => {
        result = popAction();
      });

      expect(result).toBeUndefined();
    });

    it('removes and returns the most recent action', () => {
      const store = useUndoStore.getState();

      act(() => {
        store.pushAction(makeAction({ description: 'first' }));
        store.pushAction(makeAction({ description: 'second' }));
      });

      let popped: UndoAction | undefined;
      act(() => {
        popped = useUndoStore.getState().popAction();
      });

      expect(popped!.description).toBe('second');
      expect(useUndoStore.getState().undoStack).toHaveLength(1);
      expect(useUndoStore.getState().undoStack[0].description).toBe('first');
    });

    it('supports sequential pops until empty', () => {
      const store = useUndoStore.getState();

      act(() => {
        store.pushAction(makeAction({ description: 'a' }));
        store.pushAction(makeAction({ description: 'b' }));
      });

      const results: (UndoAction | undefined)[] = [];
      act(() => {
        results.push(useUndoStore.getState().popAction());
        results.push(useUndoStore.getState().popAction());
        results.push(useUndoStore.getState().popAction());
      });

      expect(results[0]!.description).toBe('b');
      expect(results[1]!.description).toBe('a');
      expect(results[2]).toBeUndefined();
      expect(useUndoStore.getState().undoStack).toHaveLength(0);
    });
  });

  describe('peekAction', () => {
    it('returns undefined when stack is empty', () => {
      expect(useUndoStore.getState().peekAction()).toBeUndefined();
    });

    it('returns the most recent action without removing it', () => {
      act(() => {
        useUndoStore.getState().pushAction(makeAction({ description: 'peek-me' }));
      });

      const peeked = useUndoStore.getState().peekAction();
      expect(peeked!.description).toBe('peek-me');
      expect(useUndoStore.getState().undoStack).toHaveLength(1);
    });
  });

  describe('canUndo', () => {
    it('returns false when stack is empty', () => {
      expect(useUndoStore.getState().canUndo()).toBe(false);
    });

    it('returns true when stack has actions', () => {
      act(() => {
        useUndoStore.getState().pushAction(makeAction());
      });

      expect(useUndoStore.getState().canUndo()).toBe(true);
    });

    it('returns false after all actions are popped', () => {
      act(() => {
        useUndoStore.getState().pushAction(makeAction());
      });

      act(() => {
        useUndoStore.getState().popAction();
      });

      expect(useUndoStore.getState().canUndo()).toBe(false);
    });
  });

  describe('clearStack', () => {
    it('empties the entire undo stack', () => {
      act(() => {
        const store = useUndoStore.getState();
        store.pushAction(makeAction({ description: 'one' }));
        store.pushAction(makeAction({ description: 'two' }));
        store.pushAction(makeAction({ description: 'three' }));
      });

      expect(useUndoStore.getState().undoStack).toHaveLength(3);

      act(() => {
        useUndoStore.getState().clearStack();
      });

      expect(useUndoStore.getState().undoStack).toHaveLength(0);
      expect(useUndoStore.getState().canUndo()).toBe(false);
    });
  });

  describe('setIsUndoing', () => {
    it('toggles the isUndoing flag', () => {
      expect(useUndoStore.getState().isUndoing).toBe(false);

      act(() => {
        useUndoStore.getState().setIsUndoing(true);
      });
      expect(useUndoStore.getState().isUndoing).toBe(true);

      act(() => {
        useUndoStore.getState().setIsUndoing(false);
      });
      expect(useUndoStore.getState().isUndoing).toBe(false);
    });
  });

  describe('different action types', () => {
    it('handles remove-day actions', () => {
      act(() => {
        useUndoStore.getState().pushAction({
          type: 'remove-day',
          description: 'Removed day',
          data: {
            assignmentId: 'a1',
            date: '2026-03-17',
            startTime: '09:00',
            endTime: '17:00',
            userName: 'Bob',
          },
        });
      });

      const action = useUndoStore.getState().peekAction()!;
      expect(action.type).toBe('remove-day');
      if (action.type === 'remove-day') {
        expect(action.data.startTime).toBe('09:00');
        expect(action.data.endTime).toBe('17:00');
      }
    });

    it('handles move-day actions', () => {
      act(() => {
        useUndoStore.getState().pushAction({
          type: 'move-day',
          description: 'Moved day',
          data: {
            dayId: 'd1',
            originalDate: '2026-03-17',
            newDate: '2026-03-18',
            userName: 'Carol',
          },
        });
      });

      const action = useUndoStore.getState().peekAction()!;
      expect(action.type).toBe('move-day');
      if (action.type === 'move-day') {
        expect(action.data.originalDate).toBe('2026-03-17');
        expect(action.data.newDate).toBe('2026-03-18');
      }
    });

    it('handles copy-day actions', () => {
      act(() => {
        useUndoStore.getState().pushAction({
          type: 'copy-day',
          description: 'Copied day',
          data: {
            assignmentId: 'a1',
            dayId: 'd2',
            date: '2026-03-18',
            userName: 'Dave',
          },
        });
      });

      const action = useUndoStore.getState().peekAction()!;
      expect(action.type).toBe('copy-day');
    });

    it('handles status-change actions', () => {
      act(() => {
        useUndoStore.getState().pushAction({
          type: 'status-change',
          description: 'Status changed',
          data: {
            assignmentId: 'a1',
            previousStatus: 'draft',
            newStatus: 'confirmed',
            userName: 'Eve',
          },
        });
      });

      const action = useUndoStore.getState().peekAction()!;
      expect(action.type).toBe('status-change');
      if (action.type === 'status-change') {
        expect(action.data.previousStatus).toBe('draft');
        expect(action.data.newStatus).toBe('confirmed');
      }
    });
  });
});
