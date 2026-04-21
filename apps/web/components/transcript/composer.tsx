'use client';

import { useRef, useState } from 'react';
import { useSendMessage, useStopRun } from '@/lib/hooks/use-run-actions';
import { useRunStore } from '@/lib/stores/run-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ComposerProps {
  runId: string;
}

export function Composer({ runId }: ComposerProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const status = useRunStore((s) => s.status);
  const sendMessage = useSendMessage();
  const stopRun = useStopRun();

  const isTerminal = status === 'completed' || status === 'cancelled';
  const isPlanned = status === 'planned';
  const isExecuting = status === 'executing';
  const canSend = !isTerminal && !isPlanned && input.trim().length > 0;

  function handleSend() {
    if (!canSend) return;
    sendMessage.mutate(
      { runId, content: input.trim() },
      {
        onSuccess: () => {
          setInput('');
          textareaRef.current?.focus();
        },
      },
    );
  }

  function handleStop() {
    stopRun.mutate(runId);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getPlaceholder(): string {
    if (isTerminal) return `Run ${status}`;
    if (isPlanned) return 'Awaiting your approval...';
    return 'Send a message...';
  }

  return (
    <div className="border-t border-border bg-card p-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={isTerminal || isPlanned}
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
        />

        <div className="flex shrink-0 gap-1.5">
          {isExecuting && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              disabled={stopRun.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="mr-1"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSend}
            disabled={!canSend || sendMessage.isPending}
          >
            {sendMessage.isPending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
