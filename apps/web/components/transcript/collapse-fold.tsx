'use client';

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { HubEventEnvelope } from '@beagle-console/shared';
import type { CollapsibleRange } from '@/lib/scene-utils';
import { getAgentConfig } from '@/lib/agent-config';
import { useMode } from '@/lib/mode-context';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatAgentNames(agentIds: string[]): string {
  const names = agentIds.map((id) => getAgentConfig(id).displayName);
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

interface CollapseFoldProps {
  range: CollapsibleRange;
  events: Record<number, HubEventEnvelope>;
  renderEvent: (seq: number) => React.ReactNode;
}

export function CollapseFold({ range, events, renderEvent }: CollapseFoldProps) {
  const { mode } = useMode();
  const [expanded, setExpanded] = useState(mode === 'studio');

  // Reset expanded state when mode changes
  useEffect(() => {
    setExpanded(mode === 'studio');
  }, [mode]);

  const agentLabel = formatAgentNames(range.agentIds);
  const timeSpan = `${formatTime(range.startTime)} \u2014 ${formatTime(range.endTime)}`;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-md border border-dashed border-white/10 px-4 py-2 text-left transition-colors hover:border-white/20"
      >
        <div>
          <p className="text-sm text-muted-foreground">
            {agentLabel} exchanged {range.messageCount} messages
          </p>
          <p className="text-xs text-muted-foreground/60">
            {timeSpan}
          </p>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-1 border-l border-white/5 pl-3">
          {range.sequences.map((seq) => (
            <div key={seq}>{renderEvent(seq)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
