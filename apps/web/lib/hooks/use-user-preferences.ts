'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import {
  PreferencesSchema,
  UserPreferencesDefault,
  type UserPreferences,
} from '@/lib/preferences';

/**
 * Fetches the user's preferences once per session and pushes them into the
 * Zustand store so synchronous-read consumers (RunViewTabs, Composer,
 * ThemeProvider) get the truth without prop-drilling.
 */
export function useUserPreferences() {
  const setAll = usePreferencesStore((s) => s.setAll);
  const query = useQuery<UserPreferences>({
    queryKey: ['me', 'preferences'],
    queryFn: async () => {
      const res = await fetch('/api/me/preferences');
      if (!res.ok) throw new Error('Failed to fetch preferences');
      const data = await res.json();
      // Defensive: validate at the wire boundary.
      const parsed = PreferencesSchema.safeParse(data);
      return parsed.success ? parsed.data : UserPreferencesDefault;
    },
    staleTime: 60_000,
  });

  // Mirror to Zustand whenever data updates.
  useEffect(() => {
    if (query.data) setAll(query.data);
  }, [query.data, setAll]);

  return query;
}

/**
 * Patches a single preference. Optimistically updates the store, fires
 * PATCH, invalidates the query on success.
 */
export function useSetPreference() {
  const queryClient = useQueryClient();
  const patch = usePreferencesStore((s) => s.patch);
  return useMutation({
    mutationFn: async (delta: Partial<UserPreferences>) => {
      const res = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delta),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `PATCH failed (${res.status})`);
      }
      return (await res.json()) as UserPreferences;
    },
    onMutate: async (delta) => {
      // Optimistic local update so the UI reflects the change before the
      // network round-trip resolves.
      patch(delta);
    },
    onSuccess: (full) => {
      // Server-truth response replaces the optimistic delta.
      queryClient.setQueryData(['me', 'preferences'], full);
    },
  });
}
