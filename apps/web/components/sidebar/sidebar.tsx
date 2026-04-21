'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, Share2, Shield, X } from 'lucide-react';
import { ProjectList } from './project-list';
import { QuestionQueue } from './question-queue';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/lib/stores/ui-store';
import { orgClient } from '@/lib/auth-client';

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const [isOwner, setIsOwner] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Detect mobile viewport
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      const isDesktop = e.matches;
      setIsMobile(!isDesktop);
      if (isDesktop) {
        // Revert to default open on desktop
        setSidebarOpen(true);
      } else {
        // Close sidebar when resizing to mobile
        setSidebarOpen(false);
      }
    }

    // Initial check
    handleChange(mql);

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [setSidebarOpen]);

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile, setSidebarOpen]);

  useEffect(() => {
    orgClient
      .getActiveMember()
      .then((res) => {
        if (res.data?.role === 'owner') setIsOwner(true);
      })
      .catch(() => {});
  }, []);

  const closeMobile = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, setSidebarOpen]);

  // Desktop: hidden when closed, static aside
  if (!isMobile) {
    if (!sidebarOpen) return null;
    return (
      <aside className="hidden md:flex h-screen w-[260px] shrink-0 flex-col border-r border-white/10 bg-bg">
        <ScrollArea className="flex-1">
          <ProjectList />
          <Separator className="my-2" />
          <Link
            href="/runs"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="size-4" />
            Run History
          </Link>
          <Link
            href="/shared-links"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Share2 className="size-4" />
            Shared Links
          </Link>
          {isOwner && (
            <Link
              href="/audit-log"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Shield className="size-4" />
              Audit Log
            </Link>
          )}
          <Separator className="my-2" />
          <QuestionQueue />
        </ScrollArea>
      </aside>
    );
  }

  // Mobile: full-screen overlay
  if (!sidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeMobile}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside className="relative flex h-full w-[280px] flex-col bg-bg shadow-xl">
        {/* Close button */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-md p-1 text-gray-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <ScrollArea className="flex-1">
          <ProjectList />
          <Separator className="my-2" />
          <Link
            href="/runs"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="size-4" />
            Run History
          </Link>
          <Link
            href="/shared-links"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Share2 className="size-4" />
            Shared Links
          </Link>
          {isOwner && (
            <Link
              href="/audit-log"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Shield className="size-4" />
              Audit Log
            </Link>
          )}
          <Separator className="my-2" />
          <QuestionQueue />
        </ScrollArea>
      </aside>
    </div>
  );
}
