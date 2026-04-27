'use client';

import { getAgentConfig } from '@/lib/agent-config';
import { cn } from '@/lib/utils';

interface AgentAvatarProps {
  agentId: string;
  /**
   * Optional Tailwind size override (e.g. `"size-6"` for the 24px sidebar
   * variant). Defaults to `"size-8"` to preserve existing transcript layout.
   * Plan 16-02 added this hook so the sidebar AgentRow can render a denser
   * 24px avatar without forking the component.
   */
  className?: string;
}

export function AgentAvatar({ agentId, className }: AgentAvatarProps) {
  const config = getAgentConfig(agentId);

  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        config.bgColor,
        config.textOnBg,
        className,
      )}
    >
      <span className="text-sm font-semibold">{config.initial}</span>
    </div>
  );
}
