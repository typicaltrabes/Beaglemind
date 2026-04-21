'use client';

import { useQuery } from '@tanstack/react-query';
import { SentinelFlagsTable } from '@/components/operator/sentinel-flags-table';
import Link from 'next/link';

export default function OperatorSentinelPage() {
  const { data } = useQuery<unknown[]>({
    queryKey: ['operator-sentinel'],
    queryFn: async () => {
      const res = await fetch('/api/operator/sentinel');
      if (!res.ok) throw new Error('Failed to fetch sentinel flags');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/operator"
          className="text-sm text-gray-400 hover:text-white"
        >
          &larr; Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-white">
          Sentinel Flags
          {data && data.length > 0 && (
            <span className="ml-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-sm font-normal text-gray-300">
              {data.length}
            </span>
          )}
        </h1>
      </div>

      <SentinelFlagsTable />
    </div>
  );
}
