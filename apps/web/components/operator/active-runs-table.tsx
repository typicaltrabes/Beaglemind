'use client';

import { useQuery } from '@tanstack/react-query';

interface OperatorRun {
  tenantName: string;
  tenantSlug: string;
  projectName: string | null;
  runId: string;
  status: string;
  createdAt: string;
  prompt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-300',
  planned: 'bg-blue-500/20 text-blue-300',
  approved: 'bg-cyan-500/20 text-cyan-300',
  executing: 'bg-amber-500/20 text-amber-300',
  paused: 'bg-yellow-500/20 text-yellow-300',
};

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function ActiveRunsTable() {
  const { data, isLoading } = useQuery<OperatorRun[]>({
    queryKey: ['operator-runs'],
    queryFn: async () => {
      const res = await fetch('/api/operator/runs');
      if (!res.ok) throw new Error('Failed to fetch runs');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
        No active runs
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 text-left font-medium text-gray-400">Tenant</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Project</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Started</th>
            <th className="px-4 py-3 text-left font-medium text-gray-400">Prompt</th>
          </tr>
        </thead>
        <tbody>
          {data.map((run) => (
            <tr
              key={run.runId}
              className="border-b border-white/5 hover:bg-white/5"
            >
              <td className="px-4 py-3 text-gray-300">{run.tenantName}</td>
              <td className="px-4 py-3 text-gray-300">
                {run.projectName ?? '-'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[run.status] ?? 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {run.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400">
                {formatRelativeTime(run.createdAt)}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-gray-400">
                {run.prompt ? run.prompt.slice(0, 60) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
