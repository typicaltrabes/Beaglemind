'use client';

import { getAgentConfig } from '@/lib/agent-config';

interface AgentAvatarProps {
  agentId: string;
}

export function AgentAvatar({ agentId }: AgentAvatarProps) {
  const config = getAgentConfig(agentId);

  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${config.bgColor} ${config.textOnBg}`}
    >
      <span className="text-sm font-semibold">{config.initial}</span>
    </div>
  );
}
