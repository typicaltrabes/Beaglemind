'use client';

import { Square as SquareIcon, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RunIdChip } from './run-id-chip';
import { useRunStore } from '@/lib/stores/run-store';
import { useRun } from '@/lib/hooks/use-run';
import {
  formatDuration,
  formatRelativeTimestamp,
  countDistinctAgents,
} from '@/lib/run-metadata';
import { cn } from '@/lib/utils';

interface RunMetadataRowProps {
  runId: string;
  onStop: () => void;
  onShare: () => void;
  isStopPending: boolean;
}

const STATUS_PILL: Record<string, string> = {
  pending: 'rounded-full bg-gray-600/20 text-gray-400',
  planned: 'rounded-full bg-yellow-600/20 text-yellow-400',
  approved: 'rounded-full bg-blue-600/20 text-blue-400',
  executing: 'rounded-full bg-green-600/20 text-green-400 animate-pulse',
  completed: 'rounded-full bg-green-600/20 text-green-400',
  cancelled: 'rounded-full bg-red-600/20 text-red-400',
};

function GhostIconButton({
  label,
  onClick,
  disabled,
  Icon,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-50',
              destructive
                ? 'text-red-400 hover:text-red-300'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Single-line tabular metadata row for the run page header. Replaces the
 * earlier `STATUS · Run · #slug · Stop/Share` row with a denser,
 * sister-site-style layout per CONTEXT.md <decisions> Track 5:
 *
 *   [STATUS-CHIP] · #5c6304af · 2m 18s · $6.46 · 3 agents · 6 events · 3h ago
 *                                                                     [Stop] [Share]
 *
 * All metadata items use tabular-nums + text-[11px] muted-foreground.
 * Stop / Share render as ghost icon-only buttons with tooltips.
 */
export function RunMetadataRow({
  runId,
  onStop,
  onShare,
  isStopPending,
}: RunMetadataRowProps) {
  const status = useRunStore((s) => s.status);
  const eventOrder = useRunStore((s) => s.eventOrder);
  const events = useRunStore((s) => s.events);
  const { data: run } = useRun(runId);

  const eventsCount = eventOrder.length;
  const agentsCount = countDistinctAgents(events, eventOrder);

  // Cost: sum events.metadata.costUsd (mirrors run-history-table aggregate).
  let totalCostUsd = 0;
  for (const seq of eventOrder) {
    const ev = events[seq];
    const cost =
      ev?.metadata && typeof ev.metadata === 'object'
        ? (ev.metadata as Record<string, unknown>).costUsd
        : undefined;
    const n =
      typeof cost === 'string'
        ? Number(cost)
        : typeof cost === 'number'
          ? cost
          : 0;
    if (Number.isFinite(n)) totalCostUsd += n;
  }

  // Duration: only meaningful for completed runs (createdAt → updatedAt).
  let durationSeconds: number | null = null;
  if (status === 'completed' && run?.createdAt && run?.updatedAt) {
    const sec = Math.round(
      (new Date(run.updatedAt).getTime() -
        new Date(run.createdAt).getTime()) /
        1000,
    );
    if (sec >= 0 && sec <= 86_400) durationSeconds = sec;
  }

  const isExecuting = status === 'executing' || status === 'approved';
  const isCompleted = status === 'completed';

  // Phase 18-04 (H4): each metadata item gets a hover tooltip with a
  // descriptive label. The compact dot-separated row stays scannable but
  // new users can decode "4 agents" / "10 events" / "#abc123" without
  // guessing.
  function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-help">{children}</span>} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-w-0 items-center gap-3 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          <Badge
            className={cn(
              'px-2 py-0.5 text-[11px]',
              STATUS_PILL[status] ?? STATUS_PILL.pending,
            )}
          >
            {status}
          </Badge>
          <span aria-hidden="true">·</span>
          <RunIdChip runId={runId} className="text-[11px]" />
          <span aria-hidden="true">·</span>
          <MetaItem label="Run duration">
            {formatDuration(durationSeconds)}
          </MetaItem>
          <span aria-hidden="true">·</span>
          <MetaItem label="Total agent cost">
            ${totalCostUsd.toFixed(2)}
          </MetaItem>
          <span aria-hidden="true">·</span>
          <MetaItem
            label={
              agentsCount === 1
                ? 'Distinct agents that participated'
                : 'Distinct agents that participated'
            }
          >
            {agentsCount} {agentsCount === 1 ? 'agent' : 'agents'}
          </MetaItem>
          <span aria-hidden="true">·</span>
          <MetaItem label="Total events recorded">
            {eventsCount} {eventsCount === 1 ? 'event' : 'events'}
          </MetaItem>
          <span aria-hidden="true">·</span>
          <MetaItem label="When this run started">
            {formatRelativeTimestamp(run?.createdAt ?? null)}
          </MetaItem>
        </div>

        <div className="flex items-center gap-1">
          {isExecuting && (
            <GhostIconButton
              label="Stop run"
              onClick={onStop}
              disabled={isStopPending}
              Icon={SquareIcon}
              destructive
            />
          )}
          {isCompleted && (
            <GhostIconButton
              label="Share replay"
              onClick={onShare}
              Icon={Share2}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
