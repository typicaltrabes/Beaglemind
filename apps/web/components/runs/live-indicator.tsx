import { cn } from '@/lib/utils';

export interface LiveIndicatorProps {
  className?: string;
  /** When true, hides the "Live" label and renders only the pulsing dot. */
  compact?: boolean;
}

/**
 * Phase 19-04 (UX-19-07): pulsing brand-orange "Live" indicator.
 *
 * Used on the run-detail header AND run-history list rows whenever
 * status === 'executing'. Visually distinct from the agent-roster
 * presence-green dot (orange = run is live; green = agent is online) so
 * Lucas never conflates "the run is cycling" with "an agent is online."
 *
 * The pulse is on the OUTER halo (animate-ping) only — the inner solid
 * dot + label stay readable. animate-ping is GPU-accelerated; rendering
 * 30+ of these in the run-history table is not a perf concern at typical
 * run counts.
 */
export function LiveIndicator({ className, compact = false }: LiveIndicatorProps) {
  return (
    <span
      data-testid="live-indicator"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-300',
        className,
      )}
    >
      <span className="relative inline-flex size-2">
        <span
          className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75"
          aria-hidden
        />
        <span
          className="relative inline-flex size-2 rounded-full bg-amber-500"
          aria-hidden
        />
      </span>
      {!compact && <span>Live</span>}
    </span>
  );
}
