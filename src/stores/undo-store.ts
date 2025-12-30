import { create } from 'zustand';

/**
 * Types of actions that can be undone
 */
export type UndoActionType =
  | 'add-day'
  | 'remove-day'
  | 'move-day'
  | 'copy-day'
  | 'status-change';

/**
 * Base interface for all undo actions
 */
interface BaseUndoAction {
  type: UndoActionType;
  timestamp: number;
  description: string;
}

/**
 * Undo action for adding a day to an assignment
 */
interface AddDayAction extends BaseUndoAction {
  type: 'add-day';
  data: {
    assignmentId: string;
    dayId: string;
    date: string;
    userName: string;
  };
}

/**
 * Undo action for removing a day from an assignment
 */
interface RemoveDayAction extends BaseUndoAction {
  type: 'remove-day';
  data: {
    assignmentId: string;
    date: string;
    startTime: string;
    endTime: string;
    userName: string;
  };
}

/**
 * Undo action for moving a day to a new date
 */
interface MoveDayAction extends BaseUndoAction {
  type: 'move-day';
  data: {
    dayId: string;
    originalDate: string;
    newDate: string;
    userName: string;
  };
}

/**
 * Undo action for copying a day (same as add-day but with different semantics)
 */
interface CopyDayAction extends BaseUndoAction {
  type: 'copy-day';
  data: {
    assignmentId: string;
    dayId: string;
    date: string;
    userName: string;
  };
}

/**
 * Undo action for changing status
 */
interface StatusChangeAction extends BaseUndoAction {
  type: 'status-change';
  data: {
    assignmentId: string;
    previousStatus: string;
    newStatus: string;
    userName: string;
  };
}

export type UndoAction =
  | AddDayAction
  | RemoveDayAction
  | MoveDayAction
  | CopyDayAction
  | StatusChangeAction;

interface UndoStore {
  /**
   * Stack of actions that can be undone (most recent first)
   */
  undoStack: UndoAction[];

  /**
   * Maximum number of actions to keep in the stack
   */
  maxStackSize: number;

  /**
   * Whether an undo operation is currently in progress
   */
  isUndoing: boolean;

  /**
   * Push a new action onto the undo stack
   */
  pushAction: (action: Omit<UndoAction, 'timestamp'>) => void;

  /**
   * Pop the most recent action from the stack (for undo)
   */
  popAction: () => UndoAction | undefined;

  /**
   * Get the most recent action without removing it
   */
  peekAction: () => UndoAction | undefined;

  /**
   * Clear all actions from the stack
   */
  clearStack: () => void;

  /**
   * Set the undoing state
   */
  setIsUndoing: (isUndoing: boolean) => void;

  /**
   * Check if there are actions to undo
   */
  canUndo: () => boolean;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  undoStack: [],
  maxStackSize: 10,
  isUndoing: false,

  pushAction: (action) => {
    // Don't record actions while undoing (to prevent infinite loops)
    if (get().isUndoing) return;

    set((state) => {
      const newAction = {
        ...action,
        timestamp: Date.now(),
      } as UndoAction;

      const newStack = [newAction, ...state.undoStack].slice(0, state.maxStackSize);
      return { undoStack: newStack };
    });
  },

  popAction: () => {
    const state = get();
    if (state.undoStack.length === 0) return undefined;

    const [action, ...rest] = state.undoStack;
    set({ undoStack: rest });
    return action;
  },

  peekAction: () => {
    const state = get();
    return state.undoStack[0];
  },

  clearStack: () => {
    set({ undoStack: [] });
  },

  setIsUndoing: (isUndoing) => {
    set({ isUndoing });
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },
}));
