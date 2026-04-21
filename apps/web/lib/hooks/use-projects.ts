'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Fetch all projects for the current tenant.
 */
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
  });
}

/**
 * Create a new project. Invalidates the projects list on success.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Fetch runs for a specific project. Disabled when no projectId provided.
 */
export function useRuns(projectId: string | null) {
  return useQuery({
    queryKey: ['projects', projectId, 'runs'],
    queryFn: async () => {
      const res = await fetch(`/api/runs?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch runs');
      return res.json();
    },
    enabled: !!projectId,
  });
}
