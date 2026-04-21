'use client';

import { ModeProvider } from '@/lib/mode-context';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar/sidebar';
import { LogoutButton } from './logout-button';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <span className="text-lg font-semibold text-white">
              Beagle Agent Console
            </span>
            <div className="flex items-center gap-3">
              <ModeToggle />
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </ModeProvider>
  );
}
