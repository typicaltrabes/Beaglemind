'use client';

import { useEffect } from 'react';
import { useUserPreferences } from '@/lib/hooks/use-user-preferences';
import { usePreferencesStore } from '@/lib/stores/preferences-store';

/**
 * Applies preferences.theme to <html> by toggling the `dark` class.
 *
 *   theme === 'dark'  → adds .dark
 *   theme === 'light' → removes .dark
 *   theme === 'auto'  → tracks window.matchMedia('(prefers-color-scheme: dark)')
 *
 * Pre-hydration default: <html className="dark"> from app/layout.tsx — so
 * dark stays the visible state until the user opts into light. Per CONTEXT.md
 * `<decisions>` Item 6: "Plan 12-01's :root-as-dark hack reverted in favor of
 * theme switching."
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Subscribe to the query so it fires (and the Zustand mirror updates).
  useUserPreferences();
  const theme = usePreferencesStore((s) => s.preferences.theme);

  useEffect(() => {
    const root = document.documentElement;
    function apply(isDark: boolean) {
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }

    if (theme === 'dark') {
      apply(true);
      return;
    }
    if (theme === 'light') {
      apply(false);
      return;
    }
    // 'auto': follow system. Apply once and listen for change.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    apply(media.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [theme]);

  return <>{children}</>;
}
