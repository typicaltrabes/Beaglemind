'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import type { HubEventEnvelope } from '@beagle-console/shared';

import { useRunStore } from '@/lib/stores/run-store';
import { useMode } from '@/lib/mode-context';
import { getAgentColor } from '@/lib/agent-colors';
import { getAgentConfig } from '@/lib/agent-config';
import { renderEvent } from '@/components/transcript/render-event';
import {
  groupEventsByAgent,
  type AgentColumn,
} from '@/lib/boardroom-utils';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

interface BoardroomViewProps {
  runId: string;
}

function AgentHeader({ agentId }: { agentId: string }) {
  const cfg = getAgentConfig(agentId);
  return (
    <div className="flex items-center gap-2 border-b border-white/10 bg-muted/20 px-3 py-2">
      <span
        className={`inline-block size-2.5 rounded-full ${getAgentColor(agentId)}`}
        aria-hidden
      />
      <span className="text-sm font-medium text-foreground">
        {cfg.displayName}
      </span>
      {cfg.role && (
        <span className="text-xs text-muted-foreground">· {cfg.role}</span>
      )}
    </div>
  );
}

function ColumnBody({
  events,
  runId,
}: {
  events: HubEventEnvelope[];
  runId: string;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {events.map((e) => (
        <div
          key={e.sequenceNumber}
          className="border-b border-white/5 px-3 py-2"
        >
          {renderEvent(e, runId)}
        </div>
      ))}
    </div>
  );
}

function MobileAgentSection({
  column,
  runId,
}: {
  column: AgentColumn;
  runId: string;
}) {
  const [open, setOpen] = useState(true);
  const cfg = getAgentConfig(column.agentId);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 border-b border-white/10 bg-muted/20 px-3 py-2">
        <span
          className={`inline-block size-2.5 rounded-full ${getAgentColor(column.agentId)}`}
          aria-hidden
        />
        <span className="text-sm font-medium text-foreground">
          {cfg.displayName}
        </span>
        {cfg.role && (
          <span className="text-xs text-muted-foreground">· {cfg.role}</span>
        )}
        <ChevronDownIcon
          className={`ml-auto size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {column.events.map((e) => (
          <div
            key={e.sequenceNumber}
            className="border-b border-white/5 px-3 py-2"
          >
            {renderEvent(e, runId)}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BoardroomView({ runId }: BoardroomViewProps) {
  const messages = useRunStore((s) => s.messages);
  const { mode } = useMode();

  const columns: AgentColumn[] = useMemo(
    () => groupEventsByAgent(messages, mode),
    [messages, mode],
  );

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No agent activity yet
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Desktop grid — one column per agent, horizontally scrollable if many agents */}
      <div
        className="hidden h-full min-h-0 overflow-x-auto md:grid"
        style={{
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(280px, 1fr)',
        }}
      >
        {columns.map((col) => (
          <div
            key={col.agentId}
            className="flex h-full min-h-0 flex-col border-r border-white/10 last:border-r-0"
          >
            <AgentHeader agentId={col.agentId} />
            <ColumnBody events={col.events} runId={runId} />
          </div>
        ))}
      </div>

      {/* Mobile accordion — collapsible sections, one per agent */}
      <div className="flex h-full min-h-0 flex-col overflow-y-auto md:hidden">
        {columns.map((col) => (
          <MobileAgentSection
            key={col.agentId}
            column={col}
            runId={runId}
          />
        ))}
      </div>
    </div>
  );
}
