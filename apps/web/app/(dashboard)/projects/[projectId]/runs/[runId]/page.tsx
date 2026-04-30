'use client';

import { use, useEffect, useState } from 'react';
import { useRunStream } from '@/lib/hooks/use-sse';
import { useUIStore } from '@/lib/stores/ui-store';
import { useRunStore } from '@/lib/stores/run-store';
import { useStopRun } from '@/lib/hooks/use-run-actions';
import { useRun } from '@/lib/hooks/use-run';
import { useMode } from '@/lib/mode-context';
import { SlidersHorizontal } from 'lucide-react';
import { Composer } from '@/components/transcript/composer';
import { ContinueButton } from '@/components/transcript/continue-button';
import { RunViewTabs } from '@/components/run-views/run-view-tabs';
import { ProcessDrawer } from '@/components/studio/process-drawer';
import { MobileDrawerWrapper } from '@/components/studio/process-drawer-mobile';
import { InterruptButton } from '@/components/studio/interrupt-button';
import { ShareDialog } from '@/components/share/share-dialog';
import { RunMetadataRow } from '@/components/runs/run-metadata-row';
import { truncatePrompt } from '@/lib/truncate-prompt';

export default function RunPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = use(params);

  // Connect SSE
  useRunStream(runId);

  const { data: run } = useRun(runId);
  // Title precedence: AI-generated runs.title > truncated prompt > 'Untitled run'.
  // The h1 always has SOMETHING to render so the layout never shifts on load
  // (preserves Plan 12-04's no-layout-shift behavior).
  const generatedTitle = (run?.title ?? '').trim();
  const promptFallback = truncatePrompt((run?.prompt ?? '').trim(), 80);
  const titleDisplay = generatedTitle || promptFallback || 'Untitled run';

  const { mode } = useMode();
  const isStudio = mode === 'studio';

  const stopRun = useStopRun();

  // Mobile process drawer toggle
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Set active project/run in UI store
  useEffect(() => {
    useUIStore.getState().setActiveProject(projectId);
    useUIStore.getState().setActiveRun(runId);
    return () => {
      useUIStore.getState().setActiveRun(null);
    };
  }, [projectId, runId]);

  // Phase 19: hydrate run-store status from the API once the run row loads.
  // Runs are now created directly with status='executing' (no pending →
  // executing state_transition ever fires), so the store would otherwise
  // stay at 'pending' until the idle-timeout watcher emits the
  // executing → completed transition. The LiveIndicator + run-metadata-row
  // status pill both read from the store, so they need this hydration to
  // render the correct lifecycle state on page load.
  useEffect(() => {
    if (
      run?.status === 'pending' ||
      run?.status === 'planned' ||
      run?.status === 'approved' ||
      run?.status === 'executing' ||
      run?.status === 'completed' ||
      run?.status === 'cancelled'
    ) {
      useRunStore.getState().syncStatusFromApi(run.status);
    }
  }, [run?.status]);

  function handleStop() {
    stopRun.mutate(runId);
  }

  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col">
      {/* Header */}
      <div className="border-b border-white/10 overflow-hidden">
        {/* Title row — single-line truncated, reserves height before fetch resolves */}
        <h1
          className="truncate px-4 pt-3 text-base font-semibold text-foreground leading-6"
          title={titleDisplay}
        >
          {titleDisplay}
        </h1>
        <RunMetadataRow
          runId={runId}
          onStop={handleStop}
          onShare={() => setShareOpen(true)}
          isStopPending={stopRun.isPending}
        />
        {/* Phase 19-04 (UX-19-03): Continue conversation button. Auto-hides
            when status !== 'executing' so the wrapper div stays in the tree
            and the layout doesn't shift between rounds. */}
        <div className="px-4 pb-2">
          <ContinueButton runId={runId} status={run?.status ?? 'pending'} />
        </div>
        {isStudio && (
          <div className="px-4 pb-2">
            <InterruptButton runId={runId} />
          </div>
        )}
      </div>

      {/* Transcript area + optional drawer */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <RunViewTabs runId={runId} />
        </div>
        {/* Desktop: inline drawer. Mobile: overlay via wrapper */}
        {isStudio && (
          <>
            {/* Desktop inline */}
            <div className="hidden md:block">
              <ProcessDrawer runId={runId} />
            </div>
            {/* Mobile overlay */}
            <MobileDrawerWrapper
              open={mobileDrawerOpen}
              onClose={() => setMobileDrawerOpen(false)}
            >
              {/* This only renders on mobile when open */}
              <ProcessDrawer runId={runId} />
            </MobileDrawerWrapper>
          </>
        )}
      </div>

      {/* Mobile Process FAB -- only in Studio mode */}
      {isStudio && (
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-lg hover:bg-amber-500 md:hidden"
          aria-label="Open process drawer"
        >
          <SlidersHorizontal className="size-4" />
          Process
        </button>
      )}

      {/* Composer */}
      <Composer runId={runId} />

      {/* Share dialog */}
      <ShareDialog runId={runId} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
