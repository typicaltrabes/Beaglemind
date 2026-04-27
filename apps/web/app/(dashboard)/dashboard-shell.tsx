'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Menu, Settings as SettingsIcon } from 'lucide-react';
import { ModeProvider } from '@/lib/mode-context';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar/sidebar';
import { LogoutButton } from './logout-button';
import { PushPermission } from '@/components/push-permission';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { useUIStore } from '@/lib/stores/ui-store';
import { useRunStore } from '@/lib/stores/run-store';
import { computeSystemPulse } from '@/lib/system-pulse';
import { useOperator } from '@/lib/hooks/use-operator';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const eventOrder = useRunStore((s) => s.eventOrder);
  const events = useRunStore((s) => s.events);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    // Re-evaluate pulse every 15s so the dot decays from live → idle
    // even if no new events arrive (e.g. user looking at completed run).
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const lastEventIso =
    eventOrder.length > 0
      ? events[eventOrder[eventOrder.length - 1]!]?.timestamp ?? null
      : null;
  const pulse = computeSystemPulse(lastEventIso, now);

  const { data: isOperator } = useOperator();

  return (
    <ModeProvider>
      <ThemeProvider>
        <div className="flex min-h-screen bg-bg">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-bg px-4 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:text-white md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </button>
                <Link href="/" className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    data-pulse={pulse}
                    className={
                      pulse === 'live'
                        ? 'inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse'
                        : 'inline-block size-1.5 rounded-full bg-gray-500'
                    }
                  />
                  <Image
                    src="/brand/logo.jpg"
                    alt="Beagle Agent Console"
                    width={84}
                    height={45}
                    priority
                    className="rounded-md ring-1 ring-amber-500/20 object-contain"
                  />
                </Link>
              </div>
              <div className="flex items-center gap-3">
                {isOperator && (
                  <div className="hidden md:flex items-center gap-3">
                    <a
                      href="https://litellm.beaglemind.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      LiteLLM
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                    <a
                      href="https://hq.beaglemind.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Grafana
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </div>
                )}
                <ModeToggle />
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="inline-flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  <SettingsIcon className="size-4" />
                </Link>
                <LogoutButton />
              </div>
            </header>
            <PushPermission />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </ThemeProvider>
    </ModeProvider>
  );
}
