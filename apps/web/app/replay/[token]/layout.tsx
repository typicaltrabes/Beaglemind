import type { ReactNode } from 'react';

/**
 * Replay layout -- minimal chrome, NO dashboard shell, NO sidebar,
 * NO ModeProvider, NO auth (D-04, D-07).
 */
export default function ReplayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Minimal header */}
      <header className="flex h-12 shrink-0 items-center border-b border-white/5 px-4">
        <span className="text-sm font-medium text-muted-foreground">
          Beagle Agent Console
        </span>
      </header>

      {/* Main content area — needs flex+min-h-0 so the inner h-full /
          flex-1 chains in the page resolve to a real pixel height; previously
          the Virtuoso scroller collapsed to 0px and the transcript was
          invisible (Phase 18-02 followup). */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>

      {/* Footer */}
      <footer className="flex h-10 shrink-0 items-center justify-center border-t border-white/5">
        <span className="text-xs text-muted-foreground/60">
          Powered by Beagle Agent Console
        </span>
      </footer>
    </div>
  );
}
