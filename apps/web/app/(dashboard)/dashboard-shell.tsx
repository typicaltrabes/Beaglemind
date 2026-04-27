'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Menu, Settings as SettingsIcon } from 'lucide-react';
import { ModeProvider } from '@/lib/mode-context';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar/sidebar';
import { LogoutButton } from './logout-button';
import { PushPermission } from '@/components/push-permission';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { useUIStore } from '@/lib/stores/ui-store';
import { useOperator } from '@/lib/hooks/use-operator';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

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
                  <Image
                    src="/brand/logo.jpg"
                    alt="Beagle Agent Console"
                    width={56}
                    height={56}
                    priority
                    className="rounded-md ring-1 ring-amber-500/20 object-contain"
                  />
                  <span className="text-[18px] font-semibold tracking-tight text-white">
                    Beagle Agent{' '}
                    <em className="not-italic font-bold text-amber-400">Console</em>
                  </span>
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
