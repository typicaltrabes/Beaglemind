'use client';

import { TldrBanner } from '@/components/transcript/tldr-banner';
import { MessageList } from '@/components/transcript/message-list';

interface WritersRoomViewProps {
  runId: string;
}

/**
 * Writers' Room tab content.
 *
 * Wraps the existing TldrBanner + MessageList composition unchanged. The only
 * structural change vs. pre-tabs is this thin `<div className="flex flex-1
 * min-h-0 flex-col">` wrapper so the panel fills the run-view tab container.
 */
export function WritersRoomView({ runId }: WritersRoomViewProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <TldrBanner />
      <MessageList runId={runId} />
    </div>
  );
}
