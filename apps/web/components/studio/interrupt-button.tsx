'use client';

import { useMemo } from 'react';
import { Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRunStore } from '@/lib/stores/run-store';
import { useSendMessage } from '@/lib/hooks/use-run-actions';
import { getAgentConfig } from '@/lib/agent-config';

interface InterruptButtonProps {
  runId: string;
}

export function InterruptButton({ runId }: InterruptButtonProps) {
  const events = useRunStore((s) => s.events);
  const eventOrder = useRunStore((s) => s.eventOrder);
  const status = useRunStore((s) => s.status);

  const sendMessage = useSendMessage();

  // Find the most recent active agent (not user/system)
  const activeAgentId = useMemo(() => {
    for (let i = eventOrder.length - 1; i >= 0; i--) {
      const event = events[eventOrder[i]!];
      if (
        event?.type === 'agent_message' &&
        event.agentId !== 'user' &&
        event.agentId !== 'system'
      ) {
        return event.agentId;
      }
    }
    return null;
  }, [events, eventOrder]);

  const isInFlight = status === 'executing' || status === 'approved';

  if (!activeAgentId || !isInFlight) return null;

  const agentConfig = getAgentConfig(activeAgentId);

  function handleInterrupt() {
    // TODO: Replace with dedicated /interrupt endpoint when Hub supports per-agent interrupt
    // For now, send a system interrupt message via the existing send endpoint
    sendMessage.mutate({
      runId,
      content: `[SYSTEM] Interrupt requested for ${agentConfig.displayName}`,
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      onClick={handleInterrupt}
      disabled={sendMessage.isPending}
    >
      <Pause className="size-3" />
      Interrupt {agentConfig.displayName}
    </Button>
  );
}
