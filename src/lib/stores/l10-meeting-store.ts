import { create } from 'zustand';
import type { MeetingSegment } from '@/types/l10';

interface L10MeetingStore {
  activeMeetingId: string | null;
  currentSegment: MeetingSegment | null;
  isTimerRunning: boolean;
  elapsedSeconds: number;
  segmentElapsedSeconds: number;

  setActiveMeeting: (meetingId: string, segment: MeetingSegment) => void;
  clearActiveMeeting: () => void;
  setCurrentSegment: (segment: MeetingSegment) => void;
  tickTimer: () => void;
  setTimerRunning: (running: boolean) => void;
  resetSegmentTimer: () => void;
}

export const useL10MeetingStore = create<L10MeetingStore>((set) => ({
  activeMeetingId: null,
  currentSegment: null,
  isTimerRunning: false,
  elapsedSeconds: 0,
  segmentElapsedSeconds: 0,

  setActiveMeeting: (meetingId, segment) =>
    set({
      activeMeetingId: meetingId,
      currentSegment: segment,
      isTimerRunning: true,
      elapsedSeconds: 0,
      segmentElapsedSeconds: 0,
    }),

  clearActiveMeeting: () =>
    set({
      activeMeetingId: null,
      currentSegment: null,
      isTimerRunning: false,
      elapsedSeconds: 0,
      segmentElapsedSeconds: 0,
    }),

  setCurrentSegment: (segment) =>
    set({
      currentSegment: segment,
      segmentElapsedSeconds: 0,
    }),

  tickTimer: () =>
    set((state) => ({
      elapsedSeconds: state.elapsedSeconds + 1,
      segmentElapsedSeconds: state.segmentElapsedSeconds + 1,
    })),

  setTimerRunning: (running) => set({ isTimerRunning: running }),

  resetSegmentTimer: () => set({ segmentElapsedSeconds: 0 }),
}));
