'use client';

import { Activity, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useRunHistorySummary } from '@/lib/hooks/use-run-history-summary';
import { KpiCard } from './kpi-card';

interface RunHistorySummaryProps {
  agent?: string;
}

function formatUsd(n: number): string {
  // Compact USD: keep two decimals to mirror RunCostBadge.
  return `$${n.toFixed(2)}`;
}

/**
 * 4-tile KPI strip rendered above the Run History search/filter row. Per
 * CONTEXT.md <decisions> Track 3: 4 columns desktop, 1 column on mobile.
 *
 * Loading state delegates to <KpiCard isLoading />; the strip stays mounted
 * (skeletons in place of numbers) so the table below isn't blocked.
 */
export function RunHistorySummary({ agent }: RunHistorySummaryProps) {
  const { data, isLoading } = useRunHistorySummary({ agent });

  const totalRuns = data?.totalRuns ?? 0;
  const totalSpendUsd = data?.totalSpendUsd ?? 0;
  const avgCostUsd = data?.avgCostUsd ?? 0;
  const completedToday = data?.completedToday ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <KpiCard
        label="Total Runs"
        value={String(totalRuns)}
        subLabel={agent ? `Filtered by ${agent}` : 'All time'}
        Icon={Activity}
        isLoading={isLoading}
      />
      <KpiCard
        label="Total Spend"
        value={formatUsd(totalSpendUsd)}
        subLabel={agent ? `${agent} only` : 'All-time agent cost'}
        Icon={DollarSign}
        isLoading={isLoading}
      />
      <KpiCard
        label="Avg Cost / Run"
        value={formatUsd(avgCostUsd)}
        subLabel={agent ? `${agent} per completed run` : 'Per completed run'}
        Icon={TrendingUp}
        isLoading={isLoading}
      />
      <KpiCard
        label="Completed Today"
        value={String(completedToday)}
        subLabel="Last 24 hours"
        Icon={CheckCircle2}
        isLoading={isLoading}
      />
    </div>
  );
}
