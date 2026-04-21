'use client';

import { useMemo, useState } from 'react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getAgentConfig } from '@/lib/agent-config';
import type { HubEventEnvelope } from '@beagle-console/shared';

interface CostSectionProps {
  events: Record<number, HubEventEnvelope>;
  eventOrder: number[];
}

interface CostData {
  totalSpent: number;
  estimate: number | null;
  perAgent: Record<string, number>;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function CostSection({ events, eventOrder }: CostSectionProps) {
  const [open, setOpen] = useState(true);

  const cost = useMemo<CostData>(() => {
    let totalSpent = 0;
    let estimate: number | null = null;
    const perAgent: Record<string, number> = {};

    for (const seq of eventOrder) {
      const event = events[seq];
      if (!event) continue;

      const meta = event.metadata as Record<string, unknown> | undefined;

      // Accumulate cost from agent_message events
      if (event.type === 'agent_message' && typeof meta?.costUsd === 'number') {
        totalSpent += meta.costUsd as number;
        const agentId = event.agentId;
        perAgent[agentId] = (perAgent[agentId] ?? 0) + (meta.costUsd as number);
      }

      // Read estimate from plan_proposal
      if (
        event.type === 'plan_proposal' &&
        typeof meta?.estimatedCostUsd === 'number'
      ) {
        estimate = meta.estimatedCostUsd as number;
      }
    }

    return { totalSpent, estimate, perAgent };
  }, [events, eventOrder]);

  const agentEntries = Object.entries(cost.perAgent);
  const progressPercent =
    cost.estimate && cost.estimate > 0
      ? Math.min((cost.totalSpent / cost.estimate) * 100, 100)
      : null;

  return (
    <Collapsible defaultOpen open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cost
        </span>
        {open ? (
          <ChevronUp className="size-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        <div className="flex flex-col gap-2">
          {/* Total spent */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">
              {formatCost(cost.totalSpent)}
            </span>
            <span className="text-[10px] text-muted-foreground">spent</span>
            {cost.estimate !== null && (
              <span className="text-[10px] text-muted-foreground">
                / {formatCost(cost.estimate)} est.
              </span>
            )}
          </div>

          {/* Progress bar (only when estimate exists) */}
          {progressPercent !== null && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Per-agent breakdown */}
          {agentEntries.length > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {agentEntries.map(([agentId, agentCost]) => {
                const config = getAgentConfig(agentId);
                return (
                  <span key={agentId} className="text-[10px]">
                    <span className={config.nameColor}>
                      {config.displayName}
                    </span>
                    <span className="text-muted-foreground">
                      : {formatCost(agentCost)}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cost data appears as agents respond
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
