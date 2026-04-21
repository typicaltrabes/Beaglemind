'use client';

import { useEffect, useRef } from 'react';
import { useRunStore } from '@/lib/stores/run-store';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlanCard } from './plan-card';
import { QuestionCard } from './question-card';
import { ArtifactCard } from './artifact-card';

// Agent color map: Mo=amber, Jarvis=teal, user=blue, default=gray
const AGENT_COLORS: Record<string, string> = {
  mo: 'text-amber-500',
  jarvis: 'text-teal-500',
  user: 'text-blue-400',
};

function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId.toLowerCase()] ?? 'text-gray-400';
}

function AgentMessage({ event }: { event: HubEventEnvelope }) {
  const content = event.content as { text?: string };
  const colorClass = getAgentColor(event.agentId);

  return (
    <div className="space-y-1 py-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${colorClass}`}>
          {event.agentId}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap">
        {content.text ?? JSON.stringify(event.content)}
      </p>
    </div>
  );
}

function StateTransitionMessage({ event }: { event: HubEventEnvelope }) {
  const content = event.content as { from?: string; to?: string };

  return (
    <div className="py-2 text-center">
      <span className="text-xs text-muted-foreground">
        Run transitioned from{' '}
        <span className="font-medium">{content.from}</span> to{' '}
        <span className="font-medium">{content.to}</span>
      </span>
    </div>
  );
}

function renderEvent(event: HubEventEnvelope, runId: string) {
  switch (event.type) {
    case 'plan_proposal':
      return <PlanCard event={event} runId={runId} />;
    case 'question':
      return <QuestionCard event={event} runId={runId} />;
    case 'artifact':
      return <ArtifactCard event={event} />;
    case 'agent_message':
      return <AgentMessage event={event} />;
    case 'state_transition':
      return <StateTransitionMessage event={event} />;
    case 'system':
      return null;
    default:
      return null;
  }
}

interface MessageListProps {
  runId: string;
}

export function MessageList({ runId }: MessageListProps) {
  const eventOrder = useRunStore((s) => s.eventOrder);
  const events = useRunStore((s) => s.events);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventOrder.length]);

  if (eventOrder.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Waiting for events...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {eventOrder.map((seq) => {
          const event = events[seq];
          if (!event) return null;
          return (
            <div key={seq}>
              {renderEvent(event, runId)}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
