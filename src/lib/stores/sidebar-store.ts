import { create } from 'zustand';

interface SidebarStore {
  isOpen: boolean;          // Mobile drawer
  isCollapsed: boolean;     // Desktop collapsed mode
  open: () => void;
  close: () => void;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: false,
  isCollapsed: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  collapse: () => set({ isCollapsed: true }),
  expand: () => set({ isCollapsed: false }),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
}));
