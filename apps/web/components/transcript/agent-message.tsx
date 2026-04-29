'use client';

import type { HubEventEnvelope } from '@beagle-console/shared';
import { AgentAvatar } from './agent-avatar';
import { UserMessageAttachments } from './user-message-attachments';
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

/**
 * Chip background helper — converts a solid `bg-[#hex]` token into a low-opacity
 * `bg-[#hex]/15` token suitable for a speaker chip. Defensive fallback: if the
 * input does NOT match the `bg-[#...]` arbitrary-value pattern (e.g. a future
 * `bg-amber-500` from a Tailwind palette token), return it unchanged.
 */
function chipBgClass(bgColor: string): string {
  // matches 'bg-[#f7b733]' but not 'bg-amber-500' or 'bg-gray-500'
  const m = bgColor.match(/^bg-\[(#[0-9a-fA-F]{3,8})\]$/);
  if (!m) return bgColor;
  return `bg-[${m[1]}]/15`;
}

export function AgentMessage({ event }: AgentMessageProps) {
  const config = getAgentConfig(event.agentId);
  // Phase 17.1-06 (DEFECT-17-B): widen the content cast so user-authored
  // events with attachments can render chips below the text. Pre-17.1-06
  // user events have no `attachmentIds` field — the conditional below
  // suppresses the chip surface entirely so older runs render unchanged.
  const content = event.content as { text?: string; attachmentIds?: string[] };

  // Phase 18-04 (M3): failure-bubbles get distinct visual treatment so they
  // don't read like a real reply. Hub sets metadata.errorKind='agent_failure'.
  const isFailure =
    event.metadata !== null &&
    typeof event.metadata === 'object' &&
    (event.metadata as Record<string, unknown>).errorKind === 'agent_failure';

  return (
    <div className="flex gap-3 px-4 py-2">
      <AgentAvatar agentId={event.agentId} />
      <div className="min-w-0 flex-1">
        {/* Speaker chip — distinct from body prose. Background uses the agent's bgColor at low opacity so a long thread is scannable. */}
        <div
          className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0 rounded-md px-2 py-0.5 ${chipBgClass(config.bgColor)}`}
        >
          <span className={`text-[13px] font-semibold leading-tight ${config.nameColor}`}>
            {config.displayName}
          </span>
          {config.role && !isFailure && (
            <span className="text-[11px] text-muted-foreground">
              &middot; {config.role}
            </span>
          )}
          {isFailure && (
            <span className="text-[11px] uppercase tracking-wider text-amber-500/80">
              &middot; failure
            </span>
          )}
          <span className="text-[11px] text-[#6b7389]">
            {formatRelativeTime(event.timestamp)}
          </span>
        </div>
        <p
          className={
            // Phase 18-07 (M12): break-words + overflow-wrap-anywhere so long
            // URLs / no-space content don't overflow the bubble on mobile.
            isFailure
              ? 'mt-1 text-xs italic text-muted-foreground/70 whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
              : 'mt-1 text-sm text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
          }
        >
          {content.text ?? JSON.stringify(event.content)}
        </p>
        {/* Phase 17.1-06 (DEFECT-17-B): user-authored events with
            attachmentIds render WhatsApp-style chips beneath the text —
            never the extracted PDF/MD content dump. Suppressed for agent
            messages and for legacy user events without attachmentIds, so
            no visual regression on existing transcripts. */}
        {event.agentId === 'user' &&
          content.attachmentIds &&
          content.attachmentIds.length > 0 && (
            <UserMessageAttachments attachmentIds={content.attachmentIds} />
          )}
      </div>
    </div>
  );
}
