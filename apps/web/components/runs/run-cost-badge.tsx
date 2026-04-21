'use client';

interface RunCostBadgeProps {
  costUsd: number;
}

export function RunCostBadge({ costUsd }: RunCostBadgeProps) {
  if (costUsd === 0) {
    return <span className="text-xs text-muted-foreground">--</span>;
  }

  const colorClass =
    costUsd < 5
      ? 'text-emerald-400'
      : costUsd <= 20
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      ${costUsd.toFixed(2)}
    </span>
  );
}
