'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AgentAvatar } from '@/components/transcript/agent-avatar';
import { getAgentConfig } from '@/lib/agent-config';
import { useRunStore } from '@/lib/stores/run-store';
import { computePresence, type PresenceStatus } from '@/lib/presence';
import { cn } from '@/lib/utils';

interface AgentRowProps {
  agentId: string;
}

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  live: 'bg-emerald-500 animate-pulse',
  ready: 'bg-amber-500',
  offline: 'bg-gray-500',
};

/**
 * Sidebar agent row. Click navigates to /runs?agent=<id>. Per CONTEXT.md
 * <decisions> Track 2: avatar (24px) + name + role + presence dot (12px,
 * right-justified, animated when live).
 *
 * Presence is pure-derived from useRunStore.events. The row re-evaluates
 * presence on a 15s interval so 'live' decays naturally to 'ready' to
 * 'offline' even if no new event arrives.
 */
export function AgentRow({ agentId }: AgentRowProps) {
  const router = useRouter();
  const config = getAgentConfig(agentId);
  const events = useRunStore((s) => s.events);
  const eventOrder = useRunStore((s) => s.eventOrder);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const presence = computePresence(events, eventOrder, agentId, now);

  function handleClick() {
    router.push(`/runs?agent=${encodeURIComponent(agentId)}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Filter Run History to ${config.displayName}`}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
    >
      <AgentAvatar agentId={agentId} className="size-6" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-sm font-semibold', config.nameColor)}>
          {config.displayName}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {config.role}
        </span>
      </div>
      <span
        aria-label={`presence: ${presence}`}
        title={
          presence === 'live'
            ? 'Live — produced an event in the last 60s'
            : presence === 'ready'
            ? 'Ready — active in the last 30 minutes'
            : 'Offline — no recent activity'
        }
        className={cn('size-1.5 shrink-0 rounded-full', PRESENCE_DOT[presence])}
      />
    </button>
  );
}
