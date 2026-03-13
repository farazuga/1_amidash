import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentPage {
  href: string;
  title: string;
  visitedAt: number;
}

interface RecentPagesStore {
  pages: RecentPage[];
  addPage: (href: string, title: string) => void;
}

export const useRecentPagesStore = create<RecentPagesStore>()(
  persist(
    (set) => ({
      pages: [],
      addPage: (href, title) =>
        set((state) => {
          const filtered = state.pages.filter((p) => p.href !== href);
          return {
            pages: [{ href, title, visitedAt: Date.now() }, ...filtered].slice(0, 5),
          };
        }),
    }),
    { name: 'amidash-recent-pages' }
  )
);
