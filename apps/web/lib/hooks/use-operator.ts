'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Reads the current user's operator status from /api/me/operator.
 * Auth-gated; a 401 resolves to false (caller is anonymous).
 */
export function useOperator() {
  return useQuery<boolean>({
    queryKey: ['me', 'operator'],
    queryFn: async () => {
      const res = await fetch('/api/me/operator');
      if (res.status === 401) return false;
      if (!res.ok) throw new Error('Failed to fetch operator status');
      const data = (await res.json()) as { isOperator: boolean };
      return Boolean(data.isOperator);
    },
    staleTime: 5 * 60_000,
  });
}
