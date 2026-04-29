'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Breadcrumb } from '@/components/breadcrumb';
import { RunHistoryTable } from '@/components/runs/run-history-table';
import { RunHistorySummary } from '@/components/runs/run-history-summary';
import { useRunHistory } from '@/lib/hooks/use-run-history';

const STATUSES = [
  'pending',
  'planned',
  'approved',
  'executing',
  'completed',
  'cancelled',
] as const;

const PAGE_SIZE = 50;

export default function RunHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Phase 16-03: read ?agent= from the URL (set by Plan 16-02 sidebar
  // AgentRow click). Forward into both data hooks; surface as a
  // dismissible filter pill next to the page title.
  const agentParam = searchParams.get('agent') ?? undefined;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set()
  );
  const [offset, setOffset] = useState(0);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setOffset(0); // Reset pagination on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const statusFilter = useMemo(() => {
    if (selectedStatuses.size === 0) return undefined;
    return Array.from(selectedStatuses).join(',');
  }, [selectedStatuses]);

  const { data, isLoading } = useRunHistory({
    status: statusFilter,
    search: debouncedSearch || undefined,
    agent: agentParam,
    limit: PAGE_SIZE,
    offset,
  });

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    setOffset(0); // Reset pagination on filter change
  }

  function clearFilters() {
    setSelectedStatuses(new Set());
    setOffset(0);
  }

  return (
    <>
      <Breadcrumb trail={["BEAGLELABS", "RUN HISTORY"]} />
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Run History</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse all runs across projects
            </p>
          </div>
          {agentParam && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-400">
                Agent: {agentParam.charAt(0).toUpperCase() + agentParam.slice(1)}
                <button
                  type="button"
                  onClick={() => router.push('/runs')}
                  aria-label="Clear agent filter"
                  className="ml-1 rounded-full p-0.5 hover:bg-amber-500/25"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>

        {/* KPI strip (Phase 16-03) */}
        <RunHistorySummary agent={agentParam} />

        {/* Search */}
        <Input
          placeholder="Search by project name or prompt..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-md"
        />

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={clearFilters}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedStatuses.size === 0
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                selectedStatuses.has(status)
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Table */}
        <RunHistoryTable runs={runs} isLoading={isLoading} />

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {Math.min(offset + runs.length, total)} of {total} runs
          </span>
          {offset + runs.length < total && (
            <button
              onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              className="rounded-md border border-white/10 px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/5"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </>
  );
}
