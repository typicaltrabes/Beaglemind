'use client';

import { useQuery } from '@tanstack/react-query';

interface ServiceHealth {
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
  agents?: unknown[];
}

interface HealthData {
  postgres: ServiceHealth;
  redis: ServiceHealth;
  minio: ServiceHealth;
  hub: ServiceHealth;
}

const SERVICE_LABELS: Record<keyof HealthData, string> = {
  postgres: 'Postgres',
  redis: 'Redis',
  minio: 'MinIO',
  hub: 'Agent Hub',
};

function StatusDot({ status }: { status: 'ok' | 'error' }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${
        status === 'ok' ? 'bg-green-500' : 'bg-red-500'
      }`}
    />
  );
}

export function HealthCards() {
  const { data, isLoading } = useQuery<HealthData>({
    queryKey: ['operator-health'],
    queryFn: async () => {
      const res = await fetch('/api/operator/health');
      if (!res.ok) throw new Error('Failed to fetch health');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-white/10 bg-white/5 p-4"
          >
            <div className="h-4 w-20 rounded bg-white/10" />
            <div className="mt-2 h-6 w-12 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {(Object.keys(SERVICE_LABELS) as (keyof HealthData)[]).map((key) => {
        const service = data[key];
        return (
          <div
            key={key}
            className="rounded-lg border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">
                {SERVICE_LABELS[key]}
              </span>
              <StatusDot status={service.status} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">
              {service.latencyMs}ms
            </p>
            {service.error && (
              <p className="mt-1 truncate text-xs text-red-400">
                {service.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
