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
import { buildSceneGrid } from '@/lib/boardroom-grid';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { EmptyState } from './empty-state';

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
  const events = useRunStore((s) => s.events);
  const scenes = useRunStore((s) => s.scenes);
  const { mode } = useMode();

  const columns: AgentColumn[] = useMemo(
    () => groupEventsByAgent(messages, mode),
    [messages, mode],
  );

  // Desktop scene-aligned grid model. Mobile accordion still uses `columns`.
  const grid = useMemo(
    () => buildSceneGrid(messages, scenes, events),
    [messages, scenes, events],
  );

  if (columns.length === 0) {
    return (
      <EmptyState
        title="Boardroom waiting"
        body={<p>No agent activity yet.</p>}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Desktop scene-aligned grid: rows = scenes, cols = agents.
          CSS Grid with explicit column count makes alignment trivial.
          Per CONTEXT.md `<decisions>` Item 7 Boardroom. */}
      <div className="hidden h-full min-h-0 flex-col overflow-y-auto md:flex">
        {/* Sticky header row — agent names */}
        <div
          className="sticky top-0 z-10 grid border-b border-white/10 bg-bg/80 backdrop-blur"
          style={{
            gridTemplateColumns: `160px repeat(${grid.agents.length}, minmax(240px, 1fr))`,
          }}
        >
          <div className="border-r border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            Scene
          </div>
          {grid.agents.map((agentId) => {
            const cfg = getAgentConfig(agentId);
            return (
              <div
                key={`hdr-${agentId}`}
                className="flex items-center gap-2 border-r border-white/10 px-3 py-2 last:border-r-0"
              >
                <span
                  className={`inline-block size-2.5 rounded-full ${getAgentColor(agentId)}`}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">{cfg.displayName}</span>
                {cfg.role && (
                  <span className="text-xs text-muted-foreground">· {cfg.role}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scene rows */}
        {grid.rows.map((row) => (
          <div
            key={row.sceneId}
            className="grid border-b border-white/10"
            style={{
              gridTemplateColumns: `160px repeat(${grid.agents.length}, minmax(240px, 1fr))`,
            }}
          >
            {/* Scene label cell */}
            <div className="sticky left-0 border-r border-white/10 bg-muted/30 px-3 py-3 text-xs font-medium text-foreground">
              {row.sceneName}
            </div>
            {/* Agent cells */}
            {grid.agents.map((agentId) => {
              const cellEvents = row.cells[agentId] ?? [];
              return (
                <div
                  key={`${row.sceneId}-${agentId}`}
                  className="border-r border-white/10 last:border-r-0"
                >
                  {cellEvents.length === 0 ? (
                    <div className="px-3 py-2">
                      {/* Faint horizontal rule per CONTEXT.md — not just whitespace. */}
                      <div className="border-t border-white/5" />
                    </div>
                  ) : (
                    cellEvents.map((e) => (
                      <div
                        key={e.sequenceNumber}
                        className="border-b border-white/5 px-3 py-2 last:border-b-0"
                      >
                        {renderEvent(e, runId)}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
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
