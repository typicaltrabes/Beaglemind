'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRunStore } from '@/lib/stores/run-store';
import { useUIStore } from '@/lib/stores/ui-store';

/**
 * Approve a run's plan. Transitions planned -> approved -> executing.
 */
export function useApproveRun() {
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/runs/${runId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve run');
      return res.json();
    },
  });
}

/**
 * Stop a running sprint. Transitions to cancelled.
 */
export function useStopRun() {
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop run');
      return res.json();
    },
  });
}

/**
 * Answer a queued question. Optimistically updates the Zustand store.
 */
export function useAnswerQuestion() {
  return useMutation({
    mutationFn: async ({
      runId,
      questionId,
      answer,
    }: {
      runId: string;
      questionId: string;
      answer: string;
    }) => {
      const res = await fetch(`/api/runs/${runId}/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error('Failed to answer question');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      // Optimistic update: mark question as answered in Zustand store
      useRunStore.getState().updateQuestion(variables.questionId, variables.answer);
    },
  });
}

/**
 * Start a new research sprint run. Invalidates runs query and sets active run.
 */
export function useStartRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      prompt,
    }: {
      projectId: string;
      prompt: string;
    }) => {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt }),
      });
      if (!res.ok) throw new Error('Failed to start run');
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId, 'runs'] });
      // Set the new run as active in UI store
      if (data?.id) {
        useUIStore.getState().setActiveRun(data.id);
      }
    },
  });
}

/**
 * Send a user message to Mo during an active run.
 * Posts to /api/runs/[id]/messages which proxies to Hub /send.
 */
export function useSendMessage() {
  return useMutation({
    mutationFn: async ({
      runId,
      content,
    }: {
      runId: string;
      content: string;
    }) => {
      const res = await fetch(`/api/runs/${runId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
  });
}
