'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

interface SentinelFlag {
  tenantName: string;
  runId: string;
  text: string;
  severity: string;
  timestamp: string;
  agentId: string;
}

type SortKey = 'severity' | 'timestamp' | 'tenantName' | 'agentId';
type SortDir = 'asc' | 'desc';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300',
  warning: 'bg-yellow-500/20 text-yellow-300',
  info: 'bg-blue-500/20 text-blue-300',
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
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

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-left font-medium text-gray-400 hover:text-white"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {currentSort === sortKey && (
        <span className="ml-1">{currentDir === 'asc' ? '\u2191' : '\u2193'}</span>
      )}
    </th>
  );
}

export function SentinelFlagsTable() {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery<SentinelFlag[]>({
    queryKey: ['operator-sentinel'],
    queryFn: async () => {
      const res = await fetch('/api/operator/sentinel');
      if (!res.ok) throw new Error('Failed to fetch sentinel flags');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'severity' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'severity':
          cmp = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
          break;
        case 'timestamp':
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'tenantName':
          cmp = a.tenantName.localeCompare(b.tenantName);
          break;
        case 'agentId':
          cmp = a.agentId.localeCompare(b.agentId);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

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
        No sentinel flags
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <SortableHeader label="Tenant" sortKey="tenantName" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableHeader label="Agent" sortKey="agentId" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <th className="px-4 py-3 text-left font-medium text-gray-400">Flag</th>
            <SortableHeader label="Severity" sortKey="severity" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortableHeader label="Time" sortKey="timestamp" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((flag, i) => (
            <tr
              key={`${flag.runId}-${i}`}
              className="border-b border-white/5 hover:bg-white/5"
            >
              <td className="px-4 py-3 text-gray-300">{flag.tenantName}</td>
              <td className="px-4 py-3 text-gray-300">{flag.agentId}</td>
              <td className="max-w-md px-4 py-3 text-gray-300">{flag.text}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    SEVERITY_BADGE[flag.severity] ?? SEVERITY_BADGE.info
                  }`}
                >
                  {flag.severity}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                {formatRelativeTime(flag.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
