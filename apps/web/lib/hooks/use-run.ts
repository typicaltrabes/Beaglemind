'use client';

import { useQuery } from '@tanstack/react-query';

export interface Run {
  id: string;
  projectId: string;
  prompt: string | null;
  title: string | null;
  status: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
}

export function useRun(runId: string) {
  return useQuery<Run>({
    queryKey: ['runs', 'detail', runId],
    queryFn: async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) throw new Error('Failed to fetch run');
      return res.json();
    },
    enabled: !!runId,
    staleTime: 60_000,
  });
}
