'use client';

import { useQuery } from '@tanstack/react-query';

export interface RunHistoryItem {
  id: string;
  projectId: string;
  projectName: string | null;
  prompt: string | null;
  status: string;
  kind: string;
  totalCostUsd: number;
  artifactCount: number;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

interface RunHistoryResponse {
  runs: RunHistoryItem[];
  total: number;
}

interface RunHistoryParams {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useRunHistory(params: RunHistoryParams = {}) {
  return useQuery<RunHistoryResponse>({
    queryKey: ['runs', 'history', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.offset) searchParams.set('offset', String(params.offset));

      const qs = searchParams.toString();
      const url = `/api/runs/history${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch run history');
      return res.json();
    },
  });
}
