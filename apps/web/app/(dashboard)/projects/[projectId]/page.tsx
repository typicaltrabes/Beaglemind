'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/hooks/use-projects';
import { useRunHistory } from '@/lib/hooks/use-run-history';
import { useStartRun } from '@/lib/hooks/use-run-actions';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PlayIcon } from 'lucide-react';
import { RunHistoryTable } from '@/components/runs/run-history-table';
import { RunHistorySummary } from '@/components/runs/run-history-summary';

const STATUSES = [
  'pending',
  'planned',
  'approved',
  'executing',
  'completed',
  'cancelled',
] as const;

const PAGE_SIZE = 50;

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  const { data: projects } = useProjects();
  const startRun = useStartRun();

  const project = projects?.find(
    (p: { id: string }) => p.id === projectId
  );

  // Phase 18-03: project dashboard now mirrors /runs experience —
  // KPI strip + search + status chips + table, scoped to this project.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set()
  );
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const statusFilter = useMemo(() => {
    if (selectedStatuses.size === 0) return undefined;
    return Array.from(selectedStatuses).join(',');
  }, [selectedStatuses]);

  const { data, isLoading: runsLoading } = useRunHistory({
    projectId,
    status: statusFilter,
    search: debouncedSearch || undefined,
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
    setOffset(0);
  }

  function clearFilters() {
    setSelectedStatuses(new Set());
    setOffset(0);
  }

  useEffect(() => {
    useUIStore.getState().setActiveProject(projectId);
    return () => {
      useUIStore.getState().setActiveProject(null);
    };
  }, [projectId]);

  async function handleStartSprint() {
    if (!prompt.trim()) return;
    try {
      const run = await startRun.mutateAsync({
        projectId,
        prompt: prompt.trim(),
      });
      setPrompt('');
      if (run?.id) {
        router.push(`/projects/${projectId}/runs/${run.id}`);
      }
    } catch {
      // Error handled by TanStack Query
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Project header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {project?.name ?? 'Project'}
        </h1>
        {project?.description && (
          <p className="mt-1 text-sm text-gray-400">{project.description}</p>
        )}
      </div>

      {/* New Sprint composer */}
      <Card className="border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-300">
          New Research Sprint
        </h2>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the team a question…"
          rows={3}
          className="mb-3 border-white/10 bg-white/5 text-white placeholder:text-gray-500"
        />
        <Button
          onClick={handleStartSprint}
          disabled={!prompt.trim() || startRun.isPending}
        >
          <PlayIcon className="size-4" />
          {startRun.isPending ? 'Starting...' : 'Start Sprint'}
        </Button>
      </Card>

      {/* KPI strip — project-scoped (Phase 18-03) */}
      <RunHistorySummary
        projectId={projectId}
        scopeLabel={project?.name ?? undefined}
      />

      {/* Search */}
      <Input
        placeholder="Search runs in this project by prompt…"
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

      {/* Run table */}
      <RunHistoryTable runs={runs} isLoading={runsLoading} />

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
  );
}
