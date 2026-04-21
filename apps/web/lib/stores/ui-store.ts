'use client';

import { create } from 'zustand';

interface UIState {
  activeProjectId: string | null;
  activeRunId: string | null;
  sidebarOpen: boolean;
}

interface UIActions {
  setActiveProject: (id: string | null) => void;
  setActiveRun: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState & UIActions>()((set) => ({
  activeProjectId: null,
  activeRunId: null,
  sidebarOpen: true,

  setActiveProject: (id: string | null) => set({ activeProjectId: id }),
  setActiveRun: (id: string | null) => set({ activeRunId: id }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
