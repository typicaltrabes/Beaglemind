'use client';

import { useEffect } from 'react';
import { useRunStore } from '@/lib/stores/run-store';
import type { HubEventEnvelope } from '@beagle-console/shared';

/**
 * Connects an EventSource to the SSE stream for a run and feeds events
 * into the Zustand run store.
 *
 * - Resets the store via initRun when runId changes
 * - EventSource auto-reconnects with Last-Event-ID for gap-free catch-up
 * - Cleans up EventSource on unmount or runId change
 */
export function useRunStream(runId: string | null) {
  const appendEvent = useRunStore((s) => s.appendEvent);
  const initRun = useRunStore((s) => s.initRun);

  useEffect(() => {
    if (!runId) return;

    // Reset store for new run
    initRun(runId);

    const es = new EventSource(`/api/runs/${runId}/stream`);

    es.onmessage = (event: MessageEvent) => {
      try {
        const parsed: HubEventEnvelope = JSON.parse(event.data);
        appendEvent(parsed);
      } catch (err) {
        console.error('[useRunStream] Failed to parse SSE event:', err);
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects with exponential backoff.
      // On reconnect, it sends Last-Event-ID header so the server
      // replays only missed events. Combined with Zustand's
      // sequence-based dedup, this is gap-free.
      console.warn('[useRunStream] EventSource error, will auto-reconnect');
    };

    return () => {
      es.close();
    };
  }, [runId, appendEvent, initRun]);
}
