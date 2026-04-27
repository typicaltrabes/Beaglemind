'use client';

import { useEffect, useRef } from 'react';
import {
  useUserPreferences,
  useSetPreference,
} from '@/lib/hooks/use-user-preferences';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
import { type UserPreferences } from '@/lib/preferences';

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-white/5 py-3">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  // Make sure prefs are fetched + mirrored to the store.
  const { isLoading } = useUserPreferences();
  const prefs = usePreferencesStore((s) => s.preferences);
  const setPref = useSetPreference();

  // Debounce timers — one per field key, so rapidly toggling theme then
  // verbosity doesn't drop the second change.
  const timers = useRef<Map<keyof UserPreferences, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  function commit<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setPref.mutate({ [key]: value } as Partial<UserPreferences>);
    }, 400);
    timers.current.set(key, t);
  }

  // Cleanup timers on unmount so a navigation-in-flight delta still fires.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preferences sync to your account and apply on every device.
      </p>

      <div className="mt-6 rounded-lg border border-white/10 bg-card/50 px-4">
        <FieldRow label="Theme" hint="Dark by default. Auto follows your system.">
          <select
            value={prefs.theme}
            onChange={(e) => commit('theme', e.target.value as UserPreferences['theme'])}
            className="rounded-md border border-white/10 bg-background px-2 py-1 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto</option>
          </select>
        </FieldRow>

        <FieldRow label="Default tab" hint="The view you land on when opening a run.">
          <select
            value={prefs.defaultTab}
            onChange={(e) =>
              commit('defaultTab', e.target.value as UserPreferences['defaultTab'])
            }
            className="rounded-md border border-white/10 bg-background px-2 py-1 text-sm"
          >
            <option value="writers-room">Writers&apos; Room</option>
            <option value="timeline">Timeline</option>
            <option value="boardroom">Boardroom</option>
            <option value="canvas">Canvas</option>
          </select>
        </FieldRow>

        <FieldRow
          label="Default verbosity"
          hint="Starting position of the verbosity slider in Studio mode."
        >
          <select
            value={prefs.defaultVerbosity}
            onChange={(e) =>
              commit(
                'defaultVerbosity',
                e.target.value as UserPreferences['defaultVerbosity'],
              )
            }
            className="rounded-md border border-white/10 bg-background px-2 py-1 text-sm"
          >
            <option value="quiet">Quiet</option>
            <option value="normal">Normal</option>
            <option value="full">Full</option>
          </select>
        </FieldRow>

        <FieldRow
          label="Browser notifications"
          hint="Auto-prompt for push permission on this device."
        >
          <select
            value={prefs.browserNotifications}
            onChange={(e) =>
              commit(
                'browserNotifications',
                e.target.value as UserPreferences['browserNotifications'],
              )
            }
            className="rounded-md border border-white/10 bg-background px-2 py-1 text-sm"
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}
