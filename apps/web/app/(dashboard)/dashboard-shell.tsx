'use client';

import { ModeProvider } from '@/lib/mode-context';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar/sidebar';
import { LogoutButton } from './logout-button';
import { PushPermission } from '@/components/push-permission';
import { useUIStore } from '@/lib/stores/ui-store';
import { Menu } from 'lucide-react';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <ModeProvider>
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
              <span className="text-lg font-semibold text-white">
                Beagle Agent Console
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ModeToggle />
              <LogoutButton />
            </div>
          </header>
          <PushPermission />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </ModeProvider>
  );
}
