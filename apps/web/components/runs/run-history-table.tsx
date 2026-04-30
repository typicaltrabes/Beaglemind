'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RunCostBadge } from './run-cost-badge';
import { LiveIndicator } from './live-indicator';
import type { RunHistoryItem } from '@/lib/hooks/use-run-history';

interface RunHistoryTableProps {
  runs: RunHistoryItem[];
  isLoading: boolean;
}

// Phase 16-03: every status entry gets `rounded-full` so chips render as
// pills (was rounded-md from Plan 14-04). The Badge base class renders
// these tokens directly via className override.
const STATUS_VARIANT: Record<string, string> = {
  completed: 'rounded-full bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  executing: 'rounded-full bg-amber-500/15 text-amber-400 border-amber-500/20',
  running: 'rounded-full bg-amber-500/15 text-amber-400 border-amber-500/20',
  cancelled: 'rounded-full bg-red-500/15 text-red-400 border-red-500/20',
  pending: 'rounded-full bg-white/5 text-muted-foreground border-white/10',
  planned: 'rounded-full bg-white/5 text-muted-foreground border-white/10',
  approved: 'rounded-full bg-white/5 text-muted-foreground border-white/10',
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return '--';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
        </td>
      ))}
    </tr>
  );
}

export function RunHistoryTable({ runs, isLoading }: RunHistoryTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Project
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Title
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Cost
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Duration
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Artifacts
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Date
            </th>
            <th className="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : runs.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-12 text-center text-muted-foreground"
              >
                No runs found
              </td>
            </tr>
          ) : (
            runs.map((run) => (
              <tr
                key={run.id}
                onClick={() =>
                  router.push(`/projects/${run.projectId}/runs/${run.id}`)
                }
                className="group/row cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-3 text-foreground">
                  {run.projectName ?? '--'}
                </td>
                <td className="max-w-xs px-3 py-3 text-muted-foreground">
                  {truncate(run.title ?? run.prompt, 80)}
                </td>
                <td className="px-3 py-3">
                  {/* Phase 19-04 (UX-19-07): pulsing brand-orange Live
                      indicator on executing rows; static pill for every
                      other status (completed/cancelled/pending). */}
                  {run.status === 'executing' ? (
                    <LiveIndicator />
                  ) : (
                    <Badge
                      className={
                        STATUS_VARIANT[run.status] ?? STATUS_VARIANT.pending
                      }
                    >
                      {run.status}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <RunCostBadge
                    costUsd={run.totalCostUsd}
                    cancelled={run.status === 'cancelled'}
                  />
                </td>
                <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                  {formatDuration(run.durationSeconds)}
                </td>
                <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                  {run.artifactCount}
                </td>
                <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                  {formatRelativeDate(run.createdAt)}
                </td>
                <td className="w-8 px-2 py-3 text-right">
                  <ChevronRight
                    className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
                    aria-hidden="true"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
