'use client';

import { use, useEffect, useState } from 'react';
import { useRunStream } from '@/lib/hooks/use-sse';
import { useRunStore } from '@/lib/stores/run-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useStopRun } from '@/lib/hooks/use-run-actions';
import { useMode } from '@/lib/mode-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SquareIcon, Share2, SlidersHorizontal } from 'lucide-react';
import { MessageList } from '@/components/transcript/message-list';
import { TldrBanner } from '@/components/transcript/tldr-banner';
import { Composer } from '@/components/transcript/composer';
import { ProcessDrawer } from '@/components/studio/process-drawer';
import { MobileDrawerWrapper } from '@/components/studio/process-drawer-mobile';
import { InterruptButton } from '@/components/studio/interrupt-button';
import { ShareDialog } from '@/components/share/share-dialog';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-600/20 text-gray-400',
  planned: 'bg-yellow-600/20 text-yellow-400',
  approved: 'bg-blue-600/20 text-blue-400',
  executing: 'bg-green-600/20 text-green-400 animate-pulse',
  completed: 'bg-green-600/20 text-green-400',
  cancelled: 'bg-red-600/20 text-red-400',
};

export default function RunPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = use(params);

  // Connect SSE
  useRunStream(runId);

  // Read store state
  const status = useRunStore((s) => s.status);

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

  function handleStop() {
    stopRun.mutate(runId);
  }

  const [shareOpen, setShareOpen] = useState(false);
  const isCompleted = status === 'completed';
  const isExecuting = status === 'executing' || status === 'approved';

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Badge className={STATUS_STYLES[status] ?? STATUS_STYLES.pending}>
          {status}
        </Badge>
        <span className="text-sm text-gray-400">Run</span>
        <span className="truncate text-xs text-gray-600">{runId}</span>
        {isStudio && <InterruptButton runId={runId} />}
        {isCompleted && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
            className="ml-auto"
          >
            <Share2 className="size-3.5" />
            Share Replay
          </Button>
        )}
        {isExecuting && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStop}
            disabled={stopRun.isPending}
            className="ml-auto"
          >
            <SquareIcon className="size-3" />
            Stop
          </Button>
        )}
      </div>

      {/* Transcript area + optional drawer */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <TldrBanner />
          <MessageList runId={runId} />
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
