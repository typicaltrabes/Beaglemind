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
 * Phase 19-04 (UX-19-03): trigger another N rounds of round-table discussion
 * against the existing transcript without a new user message. Driven by the
 * Continue conversation button in the run-detail page header. Posts to
 * /api/runs/[id]/continue which proxies to hub /runs/start with
 * continueOnly=true.
 */
export function useContinueRun() {
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/runs/${runId}/continue`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to continue conversation');
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
 * Inputs accepted by useSendMessage. `content` is always required;
 * everything else is optional and conditionally serialized by
 * `buildSendMessageBody` so the wire shape stays minimal.
 *
 * - `attachmentIds` (Phase 17-01): artifact IDs returned by
 *   /api/runs/[id]/attachments — only ready chips contribute, empty
 *   arrays are dropped from the JSON body.
 * - `targetAgent` (Phase 04-06+): @-mention routing in Studio mode.
 * - `metadata.verbosity` (Phase 06+): Studio verbosity slider.
 */
export interface SendMessageVars {
  runId: string;
  content: string;
  attachmentIds?: string[];
  targetAgent?: string;
  metadata?: { verbosity?: number };
}

/**
 * Pure body-builder for the /api/runs/[id]/messages POST. Conditionally
 * includes optional fields so the route's existing Zod schema (which
 * doesn't yet know about attachmentIds — see Plan 17-03) keeps parsing
 * cleanly: missing keys are simpler than null/empty values.
 *
 * Exported for unit-testing without standing up React Query.
 */
export function buildSendMessageBody(vars: Omit<SendMessageVars, 'runId'>): {
  content: string;
  attachmentIds?: string[];
  targetAgent?: string;
  metadata?: { verbosity?: number };
} {
  const body: {
    content: string;
    attachmentIds?: string[];
    targetAgent?: string;
    metadata?: { verbosity?: number };
  } = { content: vars.content };
  if (vars.attachmentIds && vars.attachmentIds.length > 0) {
    body.attachmentIds = vars.attachmentIds;
  }
  if (vars.targetAgent) body.targetAgent = vars.targetAgent;
  if (vars.metadata) body.metadata = vars.metadata;
  return body;
}

/**
 * Send a user message to Mo during an active run.
 * Posts to /api/runs/[id]/messages which proxies to Hub /send.
 *
 * Phase 17-01: accepts optional attachmentIds[] for files staged via
 * /api/runs/[id]/attachments. The route's Zod schema is widened in
 * Plan 17-03; until then the field is ignored server-side, so passing
 * it is forward-compatible (the JSON parser doesn't reject unknown
 * keys with the current Zod schema since we use plain object parsing).
 */
export function useSendMessage() {
  return useMutation({
    mutationFn: async ({ runId, ...vars }: SendMessageVars) => {
      const res = await fetch(`/api/runs/${runId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSendMessageBody(vars)),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
  });
}
