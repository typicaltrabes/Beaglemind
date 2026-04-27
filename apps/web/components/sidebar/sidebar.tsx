'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  History,
  Share2,
  Shield,
  X,
  HelpCircle,
  Settings as SettingsIcon,
} from 'lucide-react';
import { ProjectList } from './project-list';
import { QuestionQueue } from './question-queue';
import { AgentRow } from './agent-row';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUIStore } from '@/lib/stores/ui-store';
import { orgClient } from '@/lib/auth-client';

const ROSTER = ['mo', 'jarvis', 'herman', 'sam'] as const;

function NavIcon({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={label}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Icon className="size-4" />
          </Link>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({ isOwner }: { isOwner: boolean }) {
  return (
    <ScrollArea className="flex-1">
      {/* AGENTS */}
      <div className="px-3 pt-3">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Agents
        </span>
        <div className="mt-2 flex flex-col gap-0.5">
          {ROSTER.map((id) => (
            <AgentRow key={id} agentId={id} />
          ))}
        </div>
      </div>

      <Separator className="my-2" />

      {/* PROJECTS (collapsible) */}
      <ProjectList />

      <Separator className="my-2" />

      {/* QUESTIONS list (existing) */}
      <QuestionQueue />

      {isOwner && (
        <>
          <Separator className="my-2" />
          <Link
            href="/audit-log"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Shield className="size-4" />
            Audit Log
          </Link>
        </>
      )}
    </ScrollArea>
  );
}

function SidebarFooter() {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-around gap-1 border-t border-white/10 px-2 py-2">
        <NavIcon href="/runs" label="Run History" Icon={History} />
        <NavIcon href="/shared-links" label="Shared Links" Icon={Share2} />
        <NavIcon
          href="/?questions=open"
          label="Questions"
          Icon={HelpCircle}
        />
        <NavIcon href="/settings" label="Settings" Icon={SettingsIcon} />
      </div>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const [isOwner, setIsOwner] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      const isDesktop = e.matches;
      setIsMobile(!isDesktop);
      if (isDesktop) setSidebarOpen(true);
      else setSidebarOpen(false);
    }
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
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

  // Desktop
  if (!isMobile) {
    if (!sidebarOpen) return null;
    return (
      <aside className="hidden md:flex h-screen w-[260px] shrink-0 flex-col border-r border-white/10 bg-bg">
        <SidebarContent isOwner={isOwner} />
        <SidebarFooter />
      </aside>
    );
  }

  // Mobile drawer
  if (!sidebarOpen) return null;
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeMobile}
        aria-hidden="true"
      />
      <aside className="relative flex h-full w-[280px] flex-col bg-bg shadow-xl">
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
        <SidebarContent isOwner={isOwner} />
        <SidebarFooter />
      </aside>
    </div>
  );
}
