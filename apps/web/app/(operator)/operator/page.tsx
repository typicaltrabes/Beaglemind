'use client';

import { useQuery } from '@tanstack/react-query';
import { HealthCards } from '@/components/operator/health-cards';
import { ActiveRunsTable } from '@/components/operator/active-runs-table';
import Link from 'next/link';

interface StatsData {
  tenantCount: number;
  activeRunsCount: number;
  cost: { last24h: number; last7d: number; last30d: number };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function OperatorDashboardPage() {
  const { data: stats } = useQuery<StatsData>({
    queryKey: ['operator-stats'],
    queryFn: async () => {
      const res = await fetch('/api/operator/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <Link
          href="/operator/sentinel"
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
        >
          Sentinel Flags
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Tenants" value={stats?.tenantCount ?? '-'} />
        <StatCard label="Active Runs" value={stats?.activeRunsCount ?? '-'} />
        <StatCard
          label="Cost (24h)"
          value={
            stats ? `$${stats.cost.last24h.toFixed(2)}` : '-'
          }
        />
      </div>

      {/* Health cards */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
          System Health
        </h2>
        <HealthCards />
      </div>

      {/* Active runs */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
          Active Runs
        </h2>
        <ActiveRunsTable />
      </div>
    </div>
  );
}
