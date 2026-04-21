'use client';

import { useQuery } from '@tanstack/react-query';

export interface DigestRun {
  id: string;
  projectId: string;
  status: string;
  prompt: string | null;
}

export interface DigestArtifact {
  id: string;
  runId: string;
  filename: string;
  sizeBytes: number;
}

export interface DigestQuestion {
  id: string;
  runId: string;
  agentId: string;
  content: string;
  answer: string | null;
}

export interface DigestData {
  since: string;
  runs: DigestRun[];
  artifacts: DigestArtifact[];
  answeredQuestions: DigestQuestion[];
  pendingCount: number;
}

export function useDigest() {
  return useQuery<DigestData>({
    queryKey: ['digest'],
    queryFn: async () => {
      const res = await fetch('/api/digest');
      if (!res.ok) throw new Error('Failed to fetch digest');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
