'use client';

import { AgentAvatar } from './agent-avatar';
import { getAgentConfig } from '@/lib/agent-config';

/**
 * Per CONTEXT.md §Defect 2: hardcode Mo / Jarvis / Herman as the agents the
 * project currently routes to. If the project starts routing to additional
 * agents, update this list AND `AGENT_CONFIG` in the same plan.
 */
const SKELETON_AGENT_IDS = ['mo', 'jarvis', 'herman'] as const;

/**
 * Format the placeholder subtitle. Hardcoded for now to keep the empty state
 * deterministic — CONTEXT.md `<specifics>` calls out that this line is "purely
 * decorative — do NOT key off any backend 'expected agents' signal that doesn't
 * exist yet."
 */
function formatAgentList(agentIds: readonly string[]): string {
  const names = agentIds.map((id) => getAgentConfig(id).displayName);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

interface SkeletonRowProps {
  agentId: string;
}

function SkeletonRow({ agentId }: SkeletonRowProps) {
  const config = getAgentConfig(agentId);
  return (
    <div className="flex gap-3 py-2">
      <AgentAvatar agentId={agentId} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[13px] font-semibold leading-tight ${config.nameColor}`}>
            {config.displayName}
          </span>
          {config.role && (
            <span className="text-[11px] text-muted-foreground">
              &middot; {config.role}
            </span>
          )}
          <span className="text-[11px] italic text-muted-foreground">
            thinking…
          </span>
        </div>
        <div
          className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-white/5"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function WritersRoomSkeleton() {
  const subtitle = `${formatAgentList(SKELETON_AGENT_IDS)} are getting ready…`;
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <p className="mb-6 text-center text-sm text-muted-foreground">
        {subtitle}
      </p>
      <div className="flex w-full max-w-2xl flex-col">
        {SKELETON_AGENT_IDS.map((agentId) => (
          <SkeletonRow key={agentId} agentId={agentId} />
        ))}
      </div>
    </div>
  );
}
