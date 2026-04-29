'use client';

import { useEffect, useState, use } from 'react';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { ReplayMessageList } from '@/components/replay/replay-message-list';

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; code: number; message: string }
  | { status: 'success'; events: HubEventEnvelope[]; tldr: string | null };

export default function ReplayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/replay/${encodeURIComponent(token)}/events`);

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          if (!cancelled) {
            setState({
              status: 'error',
              code: res.status,
              message: body.error ?? 'Unknown error',
            });
          }
          return;
        }

        const events: HubEventEnvelope[] = await res.json();

        // Extract TLDR from last tldr_update event
        let tldr: string | null = null;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i]!.type === 'tldr_update') {
            const content = events[i]!.content as { summary?: string };
            if (typeof content.summary === 'string') {
              tldr = content.summary;
            }
            break;
          }
        }

        if (!cancelled) {
          setState({ status: 'success', events, tldr });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: 'error',
            code: 0,
            message: 'Failed to load replay. Please try again.',
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // ---------- Loading state ----------

  if (state.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading replay...</p>
        </div>
      </div>
    );
  }

  // ---------- Error state (D-09: expired/revoked) ----------

  if (state.status === 'error') {
    const icon = state.code === 410 ? 'clock' : state.code === 404 ? 'search' : 'alert';

    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {icon === 'clock' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
            {icon === 'search' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
            {icon === 'alert' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {state.message}
          </h2>
          <p className="text-sm text-muted-foreground">
            {state.code === 410
              ? 'The person who shared this link may need to create a new one.'
              : state.code === 404
                ? 'This replay link may be invalid or has been removed.'
                : 'Something went wrong. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  // ---------- Success state ----------

  return (
    // Phase 18-02 followup: root layout uses min-h-screen (not h-screen),
    // so percentage heights (h-full) don't propagate to the Virtuoso
    // scroller. We use flex-1 + min-h-0 chain instead so the transcript
    // can claim the remaining vertical space without depending on an
    // explicit parent height.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* TLDR banner */}
      {state.tldr && (
        <div className="shrink-0 border-b border-white/5 px-4 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Summary:</span>{' '}
            {state.tldr}
          </p>
        </div>
      )}

      {/* Read-only transcript */}
      <div className="min-h-0 flex-1 overflow-hidden px-4">
        <ReplayMessageList events={state.events} />
      </div>
    </div>
  );
}
