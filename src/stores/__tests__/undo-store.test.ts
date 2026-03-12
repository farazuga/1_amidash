import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUndoStore } from '../undo-store';
import type { UndoAction } from '../undo-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the store to its documented initial state before every test. */
function resetStore() {
  useUndoStore.setState({
    undoStack: [],
    maxStackSize: 10,
    isUndoing: false,
  });
}

// Minimal valid action payloads (no timestamp — the store adds that).
const addDayPayload: Omit<UndoAction, 'timestamp'> = {
  type: 'add-day',
  description: 'Added Monday',
  data: {
    assignmentId: 'assign-1',
    dayId: 'day-1',
    date: '2026-02-02',
    userName: 'Alice',
  },
};

const removeDayPayload: Omit<UndoAction, 'timestamp'> = {
  type: 'remove-day',
  description: 'Removed Tuesday',
  data: {
    assignmentId: 'assign-2',
    date: '2026-02-03',
    startTime: '09:00',
    endTime: '17:00',
    userName: 'Bob',
  },
};

const moveDayPayload: Omit<UndoAction, 'timestamp'> = {
  type: 'move-day',
  description: 'Moved Wednesday',
  data: {
    dayId: 'day-3',
    originalDate: '2026-02-04',
    newDate: '2026-02-05',
    userName: 'Carol',
  },
};

const copyDayPayload: Omit<UndoAction, 'timestamp'> = {
  type: 'copy-day',
  description: 'Copied Thursday',
  data: {
    assignmentId: 'assign-4',
    dayId: 'day-4',
    date: '2026-02-05',
    userName: 'Dave',
  },
};

const statusChangePayload: Omit<UndoAction, 'timestamp'> = {
  type: 'status-change',
  description: 'Status changed to confirmed',
  data: {
    assignmentId: 'assign-5',
    previousStatus: 'tentative',
    newStatus: 'confirmed',
    userName: 'Eve',
  },
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useUndoStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // -------------------------------------------------------------------------
  // 1. Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('has an empty undo stack', () => {
      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toEqual([]);
    });

    it('has maxStackSize of 10', () => {
      const { maxStackSize } = useUndoStore.getState();
      expect(maxStackSize).toBe(10);
    });

    it('has isUndoing set to false', () => {
      const { isUndoing } = useUndoStore.getState();
      expect(isUndoing).toBe(false);
    });

    it('canUndo returns false when stack is empty', () => {
      const { canUndo } = useUndoStore.getState();
      expect(canUndo()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. pushAction — basic behaviour
  // -------------------------------------------------------------------------

  describe('pushAction', () => {
    it('adds an action to an empty stack', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(1);
    });

    it('auto-generates a numeric timestamp on the pushed action', () => {
      const before = Date.now();
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      const after = Date.now();

      const { undoStack } = useUndoStore.getState();
      const ts = undoStack[0].timestamp;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('preserves all fields from the supplied action payload', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);

      const pushed = useUndoStore.getState().undoStack[0];
      expect(pushed.type).toBe('add-day');
      expect(pushed.description).toBe('Added Monday');
      expect((pushed as Extract<UndoAction, { type: 'add-day' }>).data).toEqual(
        addDayPayload.data
      );
    });

    it('inserts newest actions at the front (LIFO order)', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack[0].type).toBe('remove-day');
      expect(undoStack[1].type).toBe('add-day');
    });

    it('stacks three actions in correct LIFO order', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);
      pushAction(moveDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack.map((a) => a.type)).toEqual([
        'move-day',
        'remove-day',
        'add-day',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // 3. pushAction — isUndoing guard
  // -------------------------------------------------------------------------

  describe('pushAction when isUndoing is true', () => {
    it('does not add an action while isUndoing is true', () => {
      useUndoStore.setState({ isUndoing: true });

      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(0);
    });

    it('resumes adding actions once isUndoing is set back to false', () => {
      useUndoStore.setState({ isUndoing: true });
      useUndoStore.getState().pushAction(addDayPayload);

      useUndoStore.setState({ isUndoing: false });
      useUndoStore.getState().pushAction(removeDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(1);
      expect(undoStack[0].type).toBe('remove-day');
    });
  });

  // -------------------------------------------------------------------------
  // 4. pushAction — maxStackSize enforcement
  // -------------------------------------------------------------------------

  describe('pushAction maxStackSize enforcement', () => {
    it('keeps only the most recent 10 items when 12 are pushed', () => {
      const { pushAction } = useUndoStore.getState();

      for (let i = 0; i < 12; i++) {
        pushAction({
          type: 'add-day',
          description: `Action ${i}`,
          data: {
            assignmentId: `assign-${i}`,
            dayId: `day-${i}`,
            date: '2026-02-02',
            userName: 'Alice',
          },
        });
      }

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(10);
    });

    it('discards the oldest actions when the stack overflows', () => {
      const { pushAction } = useUndoStore.getState();

      for (let i = 0; i < 12; i++) {
        pushAction({
          type: 'add-day',
          description: `Action ${i}`,
          data: {
            assignmentId: `assign-${i}`,
            dayId: `day-${i}`,
            date: '2026-02-02',
            userName: 'Alice',
          },
        });
      }

      // The most recent action (i=11) should be at the top.
      const { undoStack } = useUndoStore.getState();
      expect(undoStack[0].description).toBe('Action 11');
      // The oldest retained action should be i=2 (12 pushed, 10 kept).
      expect(undoStack[9].description).toBe('Action 2');
    });

    it('exactly 10 pushes fills the stack without truncation', () => {
      const { pushAction } = useUndoStore.getState();

      for (let i = 0; i < 10; i++) {
        pushAction({
          type: 'add-day',
          description: `Action ${i}`,
          data: {
            assignmentId: `assign-${i}`,
            dayId: `day-${i}`,
            date: '2026-02-02',
            userName: 'Alice',
          },
        });
      }

      expect(useUndoStore.getState().undoStack).toHaveLength(10);
    });
  });

  // -------------------------------------------------------------------------
  // 5. popAction
  // -------------------------------------------------------------------------

  describe('popAction', () => {
    it('returns the most recent action', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);

      const popped = useUndoStore.getState().popAction();
      expect(popped?.type).toBe('remove-day');
    });

    it('removes the returned action from the stack', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);

      useUndoStore.getState().popAction();

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(1);
      expect(undoStack[0].type).toBe('add-day');
    });

    it('returns the complete action object including data and timestamp', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);

      const popped = useUndoStore.getState().popAction();
      expect(popped).toMatchObject({
        type: 'add-day',
        description: 'Added Monday',
        data: addDayPayload.data,
      });
      expect(typeof popped?.timestamp).toBe('number');
    });

    it('empties the stack after popping the only item', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().popAction();

      expect(useUndoStore.getState().undoStack).toHaveLength(0);
    });

    it('successive pops return actions in LIFO order', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);
      pushAction(moveDayPayload);

      const first = useUndoStore.getState().popAction();
      const second = useUndoStore.getState().popAction();
      const third = useUndoStore.getState().popAction();

      expect(first?.type).toBe('move-day');
      expect(second?.type).toBe('remove-day');
      expect(third?.type).toBe('add-day');
    });

    it('returns undefined when the stack is empty', () => {
      const result = useUndoStore.getState().popAction();
      expect(result).toBeUndefined();
    });

    it('returns undefined on a second pop after the stack is exhausted', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().popAction(); // exhausts stack

      const result = useUndoStore.getState().popAction();
      expect(result).toBeUndefined();
    });

    it('does not mutate the stack when called on an empty stack', () => {
      useUndoStore.getState().popAction();
      expect(useUndoStore.getState().undoStack).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 6. peekAction
  // -------------------------------------------------------------------------

  describe('peekAction', () => {
    it('returns the most recent action without removing it', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);

      const peeked = useUndoStore.getState().peekAction();
      expect(peeked?.type).toBe('remove-day');
      // Stack must be untouched.
      expect(useUndoStore.getState().undoStack).toHaveLength(2);
    });

    it('returns the same action on repeated peeks', () => {
      useUndoStore.getState().pushAction(addDayPayload);

      const first = useUndoStore.getState().peekAction();
      const second = useUndoStore.getState().peekAction();

      expect(first).toBe(second);
    });

    it('returns undefined when the stack is empty', () => {
      const result = useUndoStore.getState().peekAction();
      expect(result).toBeUndefined();
    });

    it('does not modify stack length', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().pushAction(removeDayPayload);

      useUndoStore.getState().peekAction();

      expect(useUndoStore.getState().undoStack).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 7. clearStack
  // -------------------------------------------------------------------------

  describe('clearStack', () => {
    it('empties a non-empty stack', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().pushAction(removeDayPayload);

      useUndoStore.getState().clearStack();

      expect(useUndoStore.getState().undoStack).toHaveLength(0);
    });

    it('results in an empty array, not null or undefined', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().clearStack();

      expect(useUndoStore.getState().undoStack).toEqual([]);
    });

    it('is safe to call on an already-empty stack', () => {
      expect(() => useUndoStore.getState().clearStack()).not.toThrow();
      expect(useUndoStore.getState().undoStack).toEqual([]);
    });

    it('allows new pushes after clearing', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().clearStack();
      useUndoStore.getState().pushAction(removeDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(1);
      expect(undoStack[0].type).toBe('remove-day');
    });
  });

  // -------------------------------------------------------------------------
  // 8. setIsUndoing
  // -------------------------------------------------------------------------

  describe('setIsUndoing', () => {
    it('sets isUndoing to true', () => {
      useUndoStore.getState().setIsUndoing(true);
      expect(useUndoStore.getState().isUndoing).toBe(true);
    });

    it('sets isUndoing to false', () => {
      useUndoStore.setState({ isUndoing: true });
      useUndoStore.getState().setIsUndoing(false);
      expect(useUndoStore.getState().isUndoing).toBe(false);
    });

    it('is idempotent when setting true twice', () => {
      useUndoStore.getState().setIsUndoing(true);
      useUndoStore.getState().setIsUndoing(true);
      expect(useUndoStore.getState().isUndoing).toBe(true);
    });

    it('is idempotent when setting false twice', () => {
      useUndoStore.getState().setIsUndoing(false);
      useUndoStore.getState().setIsUndoing(false);
      expect(useUndoStore.getState().isUndoing).toBe(false);
    });

    it('does not affect the undo stack', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().setIsUndoing(true);

      expect(useUndoStore.getState().undoStack).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // 9. canUndo
  // -------------------------------------------------------------------------

  describe('canUndo', () => {
    it('returns false on an empty stack', () => {
      expect(useUndoStore.getState().canUndo()).toBe(false);
    });

    it('returns true after a single push', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      expect(useUndoStore.getState().canUndo()).toBe(true);
    });

    it('returns false after popping the only action', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().popAction();
      expect(useUndoStore.getState().canUndo()).toBe(false);
    });

    it('returns false after clearStack', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().clearStack();
      expect(useUndoStore.getState().canUndo()).toBe(false);
    });

    it('returns true when multiple actions are in the stack', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().pushAction(removeDayPayload);
      expect(useUndoStore.getState().canUndo()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 10. All five action types
  // -------------------------------------------------------------------------

  describe('action type: add-day', () => {
    it('stores all add-day fields correctly', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      const action = useUndoStore.getState().undoStack[0] as Extract<
        UndoAction,
        { type: 'add-day' }
      >;

      expect(action.type).toBe('add-day');
      expect(action.description).toBe('Added Monday');
      expect(action.data.assignmentId).toBe('assign-1');
      expect(action.data.dayId).toBe('day-1');
      expect(action.data.date).toBe('2026-02-02');
      expect(action.data.userName).toBe('Alice');
    });
  });

  describe('action type: remove-day', () => {
    it('stores all remove-day fields correctly', () => {
      useUndoStore.getState().pushAction(removeDayPayload);
      const action = useUndoStore.getState().undoStack[0] as Extract<
        UndoAction,
        { type: 'remove-day' }
      >;

      expect(action.type).toBe('remove-day');
      expect(action.description).toBe('Removed Tuesday');
      expect(action.data.assignmentId).toBe('assign-2');
      expect(action.data.date).toBe('2026-02-03');
      expect(action.data.startTime).toBe('09:00');
      expect(action.data.endTime).toBe('17:00');
      expect(action.data.userName).toBe('Bob');
    });
  });

  describe('action type: move-day', () => {
    it('stores all move-day fields correctly', () => {
      useUndoStore.getState().pushAction(moveDayPayload);
      const action = useUndoStore.getState().undoStack[0] as Extract<
        UndoAction,
        { type: 'move-day' }
      >;

      expect(action.type).toBe('move-day');
      expect(action.description).toBe('Moved Wednesday');
      expect(action.data.dayId).toBe('day-3');
      expect(action.data.originalDate).toBe('2026-02-04');
      expect(action.data.newDate).toBe('2026-02-05');
      expect(action.data.userName).toBe('Carol');
    });
  });

  describe('action type: copy-day', () => {
    it('stores all copy-day fields correctly', () => {
      useUndoStore.getState().pushAction(copyDayPayload);
      const action = useUndoStore.getState().undoStack[0] as Extract<
        UndoAction,
        { type: 'copy-day' }
      >;

      expect(action.type).toBe('copy-day');
      expect(action.description).toBe('Copied Thursday');
      expect(action.data.assignmentId).toBe('assign-4');
      expect(action.data.dayId).toBe('day-4');
      expect(action.data.date).toBe('2026-02-05');
      expect(action.data.userName).toBe('Dave');
    });
  });

  describe('action type: status-change', () => {
    it('stores all status-change fields correctly', () => {
      useUndoStore.getState().pushAction(statusChangePayload);
      const action = useUndoStore.getState().undoStack[0] as Extract<
        UndoAction,
        { type: 'status-change' }
      >;

      expect(action.type).toBe('status-change');
      expect(action.description).toBe('Status changed to confirmed');
      expect(action.data.assignmentId).toBe('assign-5');
      expect(action.data.previousStatus).toBe('tentative');
      expect(action.data.newStatus).toBe('confirmed');
      expect(action.data.userName).toBe('Eve');
    });
  });

  // -------------------------------------------------------------------------
  // 11. Mixed action types on the stack together
  // -------------------------------------------------------------------------

  describe('mixed action types', () => {
    it('stores different action types on the same stack without confusion', () => {
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);
      pushAction(moveDayPayload);
      pushAction(copyDayPayload);
      pushAction(statusChangePayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(5);
      expect(undoStack.map((a) => a.type)).toEqual([
        'status-change',
        'copy-day',
        'move-day',
        'remove-day',
        'add-day',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // 12. Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('rapid pushes all land on the stack (up to maxStackSize)', () => {
      const { pushAction } = useUndoStore.getState();

      // Push 5 items rapidly using the same payload reference.
      for (let i = 0; i < 5; i++) {
        pushAction(addDayPayload);
      }

      expect(useUndoStore.getState().undoStack).toHaveLength(5);
    });

    it('pop after clearStack returns undefined', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().clearStack();

      const result = useUndoStore.getState().popAction();
      expect(result).toBeUndefined();
    });

    it('peek after clearStack returns undefined', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().clearStack();

      const result = useUndoStore.getState().peekAction();
      expect(result).toBeUndefined();
    });

    it('does not share timestamp between two actions pushed in the same tick', () => {
      // Both pushes happen synchronously; timestamps may be equal but must be
      // numbers and the actions themselves must remain independent objects.
      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(typeof undoStack[0].timestamp).toBe('number');
      expect(typeof undoStack[1].timestamp).toBe('number');
      // The two actions must not be the same object reference.
      expect(undoStack[0]).not.toBe(undoStack[1]);
    });

    it('full cycle: push → peek → pop → canUndo', () => {
      useUndoStore.getState().pushAction(addDayPayload);

      expect(useUndoStore.getState().canUndo()).toBe(true);

      const peeked = useUndoStore.getState().peekAction();
      expect(peeked?.type).toBe('add-day');
      // Stack still has the item after peek.
      expect(useUndoStore.getState().undoStack).toHaveLength(1);

      const popped = useUndoStore.getState().popAction();
      expect(popped?.type).toBe('add-day');

      expect(useUndoStore.getState().canUndo()).toBe(false);
    });

    it('interleaving push and pop works correctly', () => {
      const { pushAction, popAction } = useUndoStore.getState();

      pushAction(addDayPayload);
      pushAction(removeDayPayload);
      popAction(); // removes remove-day
      pushAction(moveDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(2);
      expect(undoStack[0].type).toBe('move-day');
      expect(undoStack[1].type).toBe('add-day');
    });

    it('setIsUndoing true then false allows pushes again', () => {
      useUndoStore.getState().setIsUndoing(true);
      useUndoStore.getState().pushAction(addDayPayload);
      expect(useUndoStore.getState().undoStack).toHaveLength(0);

      useUndoStore.getState().setIsUndoing(false);
      useUndoStore.getState().pushAction(addDayPayload);
      expect(useUndoStore.getState().undoStack).toHaveLength(1);
    });

    it('maxStackSize of 11 items truncates to 10 on the 11th push', () => {
      const { pushAction } = useUndoStore.getState();

      for (let i = 0; i < 11; i++) {
        pushAction({
          type: 'add-day',
          description: `Action ${i}`,
          data: {
            assignmentId: `assign-${i}`,
            dayId: `day-${i}`,
            date: '2026-02-02',
            userName: 'Alice',
          },
        });
      }

      const { undoStack } = useUndoStore.getState();
      expect(undoStack).toHaveLength(10);
      // Most recent item is i=10.
      expect(undoStack[0].description).toBe('Action 10');
    });

    it('pushing the exact same payload twice produces two distinct stack entries', () => {
      useUndoStore.getState().pushAction(addDayPayload);
      useUndoStore.getState().pushAction(addDayPayload);

      expect(useUndoStore.getState().undoStack).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 13. Timestamp generation (using fake timers)
  // -------------------------------------------------------------------------

  describe('timestamp generation', () => {
    it('uses Date.now() at the time of push', () => {
      const fixedTime = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValueOnce(fixedTime);

      useUndoStore.getState().pushAction(addDayPayload);

      const { undoStack } = useUndoStore.getState();
      expect(undoStack[0].timestamp).toBe(fixedTime);

      vi.restoreAllMocks();
    });

    it('assigns distinct timestamps to sequential pushes when clock advances', () => {
      let tick = 1_000;
      vi.spyOn(Date, 'now').mockImplementation(() => tick++);

      const { pushAction } = useUndoStore.getState();
      pushAction(addDayPayload);
      pushAction(removeDayPayload);

      const { undoStack } = useUndoStore.getState();
      // Newer action is at index 0; it was pushed second so has the larger tick.
      expect(undoStack[0].timestamp).toBeGreaterThan(undoStack[1].timestamp);

      vi.restoreAllMocks();
    });
  });
});
