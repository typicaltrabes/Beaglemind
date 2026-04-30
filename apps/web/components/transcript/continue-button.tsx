'use client';

import { ArrowRight } from 'lucide-react';
import { useContinueRun } from '@/lib/hooks/use-run-actions';
import { useRunStore } from '@/lib/stores/run-store';
import { cn } from '@/lib/utils';

export interface ContinueButtonProps {
  runId: string;
  status: string;
  className?: string;
}

/**
 * Phase 19-04 (UX-19-03): Continue conversation button. Visible whenever
 * run.status === 'executing'. Disabled while a round is in flight (any
 * agent currently thinking) or while the mutation is pending.
 *
 * Per CONTEXT.md decisions: button is visible during a still-cycling round
 * but DISABLED — the dead-time-between-rounds problem of hiding the button
 * conditionally creates more flicker than the visible-but-disabled state.
 *
 * On click, posts to /api/runs/[id]/continue → hub /runs/start with
 * continueOnly=true → another N rounds against the existing transcript
 * without a new user message.
 */
export function ContinueButton({ runId, status, className }: ContinueButtonProps) {
  const continueRun = useContinueRun();
  const thinkingAgent = useRunStore((s) => s.thinkingAgent);

  if (status !== 'executing') return null;

  const inFlight = continueRun.isPending || thinkingAgent !== null;

  return (
    <button
      type="button"
      onClick={() => continueRun.mutate(runId)}
      disabled={inFlight}
      data-testid="continue-button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <ArrowRight className="size-3.5" aria-hidden />
      {continueRun.isPending ? 'Continuing…' : 'Continue conversation'}
    </button>
  );
}
