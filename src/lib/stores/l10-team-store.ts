import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface L10TeamStore {
  selectedTeamId: string | null;
  setSelectedTeamId: (teamId: string | null) => void;
}

export const useL10TeamStore = create<L10TeamStore>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
    }),
    {
      name: 'l10-team-store',
    }
  )
);
