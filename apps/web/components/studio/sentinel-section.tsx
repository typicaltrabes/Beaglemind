'use client';

import { useMemo, useState } from 'react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { HubEventEnvelope } from '@beagle-console/shared';

interface SentinelSectionProps {
  events: Record<number, HubEventEnvelope>;
  eventOrder: number[];
}

interface SentinelFlag {
  text: string;
  severity: 'warning' | 'critical' | 'info';
  timestamp: string;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

const SEVERITY_BORDER: Record<string, string> = {
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
  info: 'border-l-blue-500',
};

export function SentinelSection({ events, eventOrder }: SentinelSectionProps) {
  const [open, setOpen] = useState(true);

  const flags = useMemo<SentinelFlag[]>(() => {
    const result: SentinelFlag[] = [];
    for (const seq of eventOrder) {
      const event = events[seq];
      if (!event) continue;

      const meta = event.metadata as Record<string, unknown> | undefined;

      // Check for sentinel_flag event type (Sam sends these directly)
      if (event.type === 'sentinel_flag') {
        result.push({
          text:
            typeof (event.content as Record<string, unknown>).text === 'string'
              ? ((event.content as Record<string, unknown>).text as string)
              : 'Sentinel flag',
          severity:
            (meta?.severity as 'warning' | 'critical' | 'info') ?? 'info',
          timestamp: event.timestamp,
        });
        continue;
      }

      // Check for sentinel flag in metadata
      if (meta?.sentinelFlag) {
        result.push({
          text:
            typeof (event.content as Record<string, unknown>).text === 'string'
              ? ((event.content as Record<string, unknown>).text as string)
              : 'Sentinel flag',
          severity:
            (meta.severity as 'warning' | 'critical' | 'info') ?? 'info',
          timestamp: event.timestamp,
        });
        continue;
      }

      // Check for system events from sentinel source
      if (
        event.type === 'system' &&
        (event.content as Record<string, unknown>).source === 'sentinel'
      ) {
        result.push({
          text:
            typeof (event.content as Record<string, unknown>).text === 'string'
              ? ((event.content as Record<string, unknown>).text as string)
              : 'Sentinel event',
          severity:
            (meta?.severity as 'warning' | 'critical' | 'info') ?? 'info',
          timestamp: event.timestamp,
        });
      }
    }
    return result;
  }, [events, eventOrder]);

  return (
    <Collapsible defaultOpen open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sentinel
        </span>
        {open ? (
          <ChevronUp className="size-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        {flags.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            <span>No sentinel flags in this run</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {flags.map((flag, i) => (
              <div
                key={i}
                className={`border-l-2 py-1 pl-2 ${SEVERITY_BORDER[flag.severity] ?? SEVERITY_BORDER.info}`}
              >
                <p className="text-xs text-foreground">{flag.text}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(flag.timestamp)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
