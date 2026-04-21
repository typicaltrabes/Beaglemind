'use client';

import type { HubEventEnvelope } from '@beagle-console/shared';
import { AgentAvatar } from './agent-avatar';
import { getAgentConfig } from '@/lib/agent-config';

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  // Older than 24h — show HH:MM
  const d = new Date(isoString);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

interface AgentMessageProps {
  event: HubEventEnvelope;
}

export function AgentMessage({ event }: AgentMessageProps) {
  const config = getAgentConfig(event.agentId);
  const content = event.content as { text?: string };

  return (
    <div className="flex gap-3 py-2">
      <AgentAvatar agentId={event.agentId} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-sm font-medium ${config.nameColor}`}>
            {config.displayName}
          </span>
          {config.role && (
            <span className="text-xs text-muted-foreground">
              &middot; {config.role}
            </span>
          )}
          <span className="text-xs text-[#6b7389]">
            {formatRelativeTime(event.timestamp)}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {content.text ?? JSON.stringify(event.content)}
        </p>
      </div>
    </div>
  );
}
