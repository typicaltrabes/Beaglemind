'use client';

import { Activity, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useRunHistorySummary } from '@/lib/hooks/use-run-history-summary';
import { KpiCard } from './kpi-card';

interface RunHistorySummaryProps {
  agent?: string;
  projectId?: string;
  scopeLabel?: string;
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
export function RunHistorySummary({
  agent,
  projectId,
  scopeLabel,
}: RunHistorySummaryProps) {
  const { data, isLoading } = useRunHistorySummary({ agent, projectId });

  const totalRuns = data?.totalRuns ?? 0;
  const totalSpendUsd = data?.totalSpendUsd ?? 0;
  const avgCostUsd = data?.avgCostUsd ?? 0;
  const completedToday = data?.completedToday ?? 0;

  // Display name for agent (e.g. "Mo" not "mo") — Phase 18-03 trust signal.
  const agentDisplay = agent
    ? agent.charAt(0).toUpperCase() + agent.slice(1)
    : null;
  const scope = agentDisplay ?? scopeLabel ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <KpiCard
        label="Total Runs"
        value={String(totalRuns)}
        subLabel={scope ? `Scoped to ${scope}` : 'All time'}
        Icon={Activity}
        isLoading={isLoading}
      />
      <KpiCard
        label="Total Spend"
        value={formatUsd(totalSpendUsd)}
        subLabel={
          agentDisplay
            ? `${agentDisplay} only`
            : scopeLabel
              ? `${scopeLabel} agent cost`
              : 'All-time agent cost'
        }
        Icon={DollarSign}
        isLoading={isLoading}
      />
      <KpiCard
        label="Avg Cost / Run"
        value={formatUsd(avgCostUsd)}
        subLabel={
          agentDisplay
            ? `Per ${agentDisplay} run`
            : 'Per completed run'
        }
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
