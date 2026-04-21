'use client';

import { useRef, useState, useEffect } from 'react';
import { GitFork, X } from 'lucide-react';
import { useSendMessage, useStopRun } from '@/lib/hooks/use-run-actions';
import { useRunStore } from '@/lib/stores/run-store';
import { useMode } from '@/lib/mode-context';
import { AGENT_CONFIG, type AgentConfig } from '@/lib/agent-config';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

// Mentionable agents (exclude 'user')
const MENTIONABLE_AGENTS = Object.entries(AGENT_CONFIG).filter(
  ([id]) => id !== 'user',
) as [string, AgentConfig][];

interface ComposerProps {
  runId: string;
}

export function Composer({ runId }: ComposerProps) {
  const [input, setInput] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [targetAgent, setTargetAgent] = useState<string | null>(null);
  const [verbosity, setVerbosity] = useState(2);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const status = useRunStore((s) => s.status);
  const sendMessage = useSendMessage();
  const stopRun = useStopRun();
  const { mode } = useMode();
  const isStudio = mode === 'studio';

  const isCancelled = status === 'cancelled';
  const isPlanned = status === 'planned';
  const isExecuting = status === 'executing';
  // Allow sending on completed runs to continue the conversation
  const canSend = !isCancelled && !isPlanned && input.trim().length > 0;

  // Close mention dropdown on escape or click outside
  useEffect(() => {
    if (!mentionOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMentionOpen(false);
    }
    function handleClick() {
      setMentionOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    // Delay click listener to avoid immediate close
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
    }, 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClick);
      clearTimeout(timer);
    };
  }, [mentionOpen]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    // Detect @ at end of input (only in Studio mode)
    if (isStudio && val.endsWith('@') && !mentionOpen) {
      setMentionOpen(true);
    }
  }

  function selectAgent(agentId: string) {
    const config = AGENT_CONFIG[agentId];
    if (!config) return;
    setTargetAgent(agentId);
    setMentionOpen(false);
    // Replace trailing @ with @AgentName
    const trimmed = input.endsWith('@') ? input.slice(0, -1) : input;
    setInput(trimmed);
    textareaRef.current?.focus();
  }

  function clearTarget() {
    setTargetAgent(null);
    textareaRef.current?.focus();
  }

  function handleSend() {
    if (!canSend) return;
    sendMessage.mutate(
      {
        runId,
        content: input.trim(),
        ...(isStudio && targetAgent ? { targetAgent } : {}),
        ...(isStudio ? { metadata: { verbosity } } : {}),
      } as Parameters<typeof sendMessage.mutate>[0],
      {
        onSuccess: () => {
          setInput('');
          setTargetAgent(null);
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
    if (isCancelled) return `Run ${status}`;
    if (isPlanned) return 'Awaiting your approval...';
    if (targetAgent) {
      const name = AGENT_CONFIG[targetAgent]?.displayName ?? targetAgent;
      return `Message @${name}...`;
    }
    return 'Send a message...';
  }

  const VERBOSITY_LABELS = ['Quiet', 'Brief', 'Normal', 'Detailed', 'Full'];

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* Studio toolbar */}
      {isStudio && (
        <div className="mb-2 flex flex-wrap items-center gap-3 border-b border-white/5 px-2 py-1.5">
          {/* @-mention badge */}
          {targetAgent ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_CONFIG[targetAgent]?.nameColor ?? 'text-gray-400'} bg-white/5`}
            >
              @{AGENT_CONFIG[targetAgent]?.displayName ?? targetAgent}
              <button
                type="button"
                onClick={clearTarget}
                className="ml-0.5 cursor-pointer rounded-full p-0.5 hover:bg-white/10"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">
              Type @ to mention
            </span>
          )}

          {/* Verbosity slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground/60">Quiet</span>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={verbosity}
              onChange={(e) => setVerbosity(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-500 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500"
            />
            <span className="text-xs text-muted-foreground/60">Full</span>
            <span className="min-w-[52px] text-xs text-muted-foreground">
              {VERBOSITY_LABELS[verbosity]}
            </span>
          </div>

          {/* Fork button (disabled, coming soon) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className="ml-auto inline-flex items-center justify-center rounded-md px-2 py-1 text-muted-foreground opacity-50"
                disabled
              >
                <GitFork className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Fork run — coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* @-mention dropdown */}
        {isStudio && mentionOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-60 rounded-md border border-white/10 bg-card shadow-lg">
            {MENTIONABLE_AGENTS.map(([id, config]) => (
              <button
                key={id}
                type="button"
                onClick={() => selectAgent(id)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${config.bgColor} ${config.textOnBg}`}
                >
                  {config.initial}
                </span>
                <div>
                  <span className={`text-sm font-medium ${config.nameColor}`}>
                    {config.displayName}
                  </span>
                  {config.role && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {config.role}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={isCancelled || isPlanned}
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
