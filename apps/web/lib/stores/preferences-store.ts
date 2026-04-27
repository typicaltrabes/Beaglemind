'use client';
import { create } from 'zustand';
import { UserPreferencesDefault, type UserPreferences } from '@/lib/preferences';

interface PreferencesStore {
  preferences: UserPreferences;
  hydrated: boolean;
  setAll: (p: UserPreferences) => void;
  patch: (p: Partial<UserPreferences>) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  preferences: UserPreferencesDefault,
  hydrated: false,
  setAll: (p) => set({ preferences: p, hydrated: true }),
  patch: (p) =>
    set((state) => ({
      preferences: { ...state.preferences, ...p },
      hydrated: true,
    })),
}));
