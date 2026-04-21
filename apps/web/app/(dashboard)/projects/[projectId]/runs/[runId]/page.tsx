'use client';

import { use, useEffect, useState } from 'react';
import { useRunStream } from '@/lib/hooks/use-sse';
import { useRunStore } from '@/lib/stores/run-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useSendMessage, useStopRun } from '@/lib/hooks/use-run-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendIcon, SquareIcon } from 'lucide-react';
import type { HubEventEnvelope } from '@beagle-console/shared';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-600/20 text-gray-400',
  planned: 'bg-yellow-600/20 text-yellow-400',
  approved: 'bg-blue-600/20 text-blue-400',
  executing: 'bg-green-600/20 text-green-400 animate-pulse',
  completed: 'bg-green-600/20 text-green-400',
  cancelled: 'bg-red-600/20 text-red-400',
};

function EventItem({ event }: { event: HubEventEnvelope }) {
  const agentLabel = event.agentId || 'System';
  const text =
    typeof event.content.text === 'string'
      ? event.content.text
      : typeof event.content.message === 'string'
        ? event.content.message
        : JSON.stringify(event.content);

  return (
    <div className="border-b border-white/5 px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-amber-400">
          {agentLabel}
        </span>
        <Badge
          className="text-[10px]"
          variant="outline"
        >
          {event.type}
        </Badge>
        <span className="text-[10px] text-gray-600">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-gray-300">{text}</p>
    </div>
  );
}

export default function RunPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = use(params);
  const [messageInput, setMessageInput] = useState('');

  // Connect SSE
  useRunStream(runId);

  // Read store state
  const status = useRunStore((s) => s.status);
  const messages = useRunStore((s) => s.messages);

  const sendMessage = useSendMessage();
  const stopRun = useStopRun();

  // Set active project/run in UI store
  useEffect(() => {
    useUIStore.getState().setActiveProject(projectId);
    useUIStore.getState().setActiveRun(runId);
    return () => {
      useUIStore.getState().setActiveRun(null);
    };
  }, [projectId, runId]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim()) return;
    sendMessage.mutate({ runId, content: messageInput.trim() });
    setMessageInput('');
  }

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

      {/* Transcript area */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-gray-500">
                {status === 'pending'
                  ? 'Waiting for Mo to respond...'
                  : 'No events yet.'}
              </p>
            </div>
          )}
          {messages.map((event) => (
            <EventItem key={event.sequenceNumber} event={event} />
          ))}
        </div>
      </ScrollArea>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-white/10 px-4 py-3"
      >
        <Input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Send a message to Mo..."
          className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-gray-500"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!messageInput.trim() || sendMessage.isPending}
        >
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
}
