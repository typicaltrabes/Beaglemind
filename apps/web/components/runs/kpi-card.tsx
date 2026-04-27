import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  Icon: LucideIcon;
  isLoading?: boolean;
}

/**
 * Single KPI tile per CONTEXT.md <decisions> Track 3. Used by
 * <RunHistorySummary />. Loading state shows a skeleton bar in place of
 * the value so the strip height stays constant during fetch.
 */
export function KpiCard({
  label,
  value,
  subLabel,
  Icon,
  isLoading = false,
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-card/50 p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {isLoading ? (
        <div className="h-7 w-20 animate-pulse rounded bg-white/5" />
      ) : (
        <div className={cn('text-2xl font-semibold tabular-nums text-foreground')}>
          {value}
        </div>
      )}
      {subLabel && (
        <div className="text-[11px] text-muted-foreground">{subLabel}</div>
      )}
    </div>
  );
}
