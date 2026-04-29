'use client';

import { useQuery } from '@tanstack/react-query';

export interface RunHistorySummary {
  totalRuns: number;
  totalSpendUsd: number;
  avgCostUsd: number;
  completedToday: number;
}

interface SummaryParams {
  /** Optional agent filter — same predicate as /api/runs/history accepts. */
  agent?: string;
  /** Phase 18-03: optional project scope. */
  projectId?: string;
}

/**
 * Fetches /api/runs/history/summary. Optionally filtered by agent.
 *
 * Used by <RunHistorySummary /> to populate the 4-tile KPI strip on the
 * Run History page. Cached for 30s on the client to avoid re-fetching while
 * the user types in the search input (which has its own debounce).
 */
export function useRunHistorySummary(params: SummaryParams = {}) {
  return useQuery<RunHistorySummary>({
    queryKey: ['runs', 'history', 'summary', params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.agent) sp.set('agent', params.agent);
      if (params.projectId) sp.set('projectId', params.projectId);
      const qs = sp.toString();
      const url = `/api/runs/history/summary${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch run history summary');
      return res.json();
    },
    staleTime: 30_000,
  });
}
