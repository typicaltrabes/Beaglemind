'use client';

interface RunCostBadgeProps {
  costUsd: number;
  /** Phase 18-05 (H8): when run was cancelled, surface "$X spent before
   * cancellation" via title tooltip + a small annotation. */
  cancelled?: boolean;
}

export function RunCostBadge({ costUsd, cancelled = false }: RunCostBadgeProps) {
  if (costUsd === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const colorClass =
    costUsd < 5
      ? 'text-emerald-400'
      : costUsd <= 20
        ? 'text-yellow-400'
        : 'text-red-400';

  if (cancelled) {
    return (
      <span
        className={`text-xs font-medium ${colorClass} italic`}
        title="Spent before cancellation"
      >
        ${costUsd.toFixed(2)}*
      </span>
    );
  }

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      ${costUsd.toFixed(2)}
    </span>
  );
}
