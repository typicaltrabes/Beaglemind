'use client';

import { use, useEffect } from 'react';
import { useRunStream } from '@/lib/hooks/use-sse';
import { useRunStore } from '@/lib/stores/run-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useStopRun } from '@/lib/hooks/use-run-actions';
import { useMode } from '@/lib/mode-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SquareIcon } from 'lucide-react';
import { MessageList } from '@/components/transcript/message-list';
import { TldrBanner } from '@/components/transcript/tldr-banner';
import { Composer } from '@/components/transcript/composer';
import { ProcessDrawer } from '@/components/studio/process-drawer';
import { InterruptButton } from '@/components/studio/interrupt-button';

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
        {isStudio && <ProcessDrawer runId={runId} />}
      </div>

      {/* Composer */}
      <Composer runId={runId} />
    </div>
  );
}
