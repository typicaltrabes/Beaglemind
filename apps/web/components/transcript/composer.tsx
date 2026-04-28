'use client';

import { useRef, useState, useEffect } from 'react';
import { GitFork, Paperclip, Sparkles, X } from 'lucide-react';
import { useSendMessage, useStopRun } from '@/lib/hooks/use-run-actions';
import { ImprovePromptPopover } from './improve-prompt-popover';
import {
  AttachmentChip,
  type AttachmentStatus,
} from './attachment-chip';
import {
  uploadAttachment,
  AttachmentUploadError,
} from '@/lib/attachment-upload';
import { useRunStore } from '@/lib/stores/run-store';
import { usePreferencesStore } from '@/lib/stores/preferences-store';
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

type PendingAttachment = {
  localId: string;
  file: File;
  status: AttachmentStatus;
  artifactId?: string;
  error?: string;
};

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
]);
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_MESSAGE = 4;
const ACCEPT_ATTR =
  '.pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,text/plain,text/markdown';
const VALIDATION_ERROR_TIMEOUT_MS = 4000;

interface ComposerProps {
  runId: string;
}

export function Composer({ runId }: ComposerProps) {
  const [input, setInput] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [targetAgent, setTargetAgent] = useState<string | null>(null);
  const defaultVerbosityKey = usePreferencesStore(
    (s) => s.preferences.defaultVerbosity,
  );
  const VERBOSITY_KEY_TO_INDEX: Record<'quiet' | 'normal' | 'full', number> = {
    quiet: 0,
    normal: 2,
    full: 4,
  };
  const [verbosity, setVerbosity] = useState(
    VERBOSITY_KEY_TO_INDEX[defaultVerbosityKey] ?? 2,
  );
  const [improveOpen, setImproveOpen] = useState(false);

  // Phase 17-01: pending-attachment chip stack + drag-drop highlight + transient validation banner.
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const improveButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const status = useRunStore((s) => s.status);
  const sendMessage = useSendMessage();
  const stopRun = useStopRun();
  const { mode } = useMode();
  const isStudio = mode === 'studio';

  const isCancelled = status === 'cancelled';
  const isPlanned = status === 'planned';
  const isExecuting = status === 'executing';

  // Send is blocked while ANY chip is mid-upload — prevents the user from
  // sending a message that references an artifactId we don't yet have.
  const anyUploading = attachments.some((a) => a.status === 'uploading');

  // Allow sending on completed runs to continue the conversation.
  const canSend =
    !isCancelled && !isPlanned && input.trim().length > 0 && !anyUploading;

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

  // Cleanup the validation-error timer on unmount so we don't fire setState after teardown.
  useEffect(() => {
    return () => {
      if (validationErrorTimerRef.current) {
        clearTimeout(validationErrorTimerRef.current);
      }
    };
  }, []);

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

  function flashValidationError(msg: string) {
    setValidationError(msg);
    if (validationErrorTimerRef.current) {
      clearTimeout(validationErrorTimerRef.current);
    }
    validationErrorTimerRef.current = setTimeout(() => {
      setValidationError(null);
      validationErrorTimerRef.current = null;
    }, VALIDATION_ERROR_TIMEOUT_MS);
  }

  function handleFiles(filesList: FileList | File[]) {
    const incoming = Array.from(filesList);

    setAttachments((prev) => {
      const remaining = MAX_FILES_PER_MESSAGE - prev.length;
      if (remaining <= 0) return prev;

      const accepted: PendingAttachment[] = [];
      for (const file of incoming.slice(0, remaining)) {
        if (!ALLOWED_MIME.has(file.type)) {
          flashValidationError(`Unsupported file type: ${file.name}`);
          continue;
        }
        if (file.size > MAX_SIZE_BYTES) {
          flashValidationError(`File exceeds 20 MB limit: ${file.name}`);
          continue;
        }
        const localId = crypto.randomUUID();
        accepted.push({ localId, file, status: 'uploading' });

        // Fire-and-forget upload; resolve into state via setAttachments below.
        // Each file uploads in parallel — a slow PDF doesn't gate a fast PNG.
        uploadAttachment(runId, file)
          .then((res) => {
            setAttachments((cur) =>
              cur.map((a) =>
                a.localId === localId
                  ? { ...a, status: 'ready', artifactId: res.artifactId }
                  : a,
              ),
            );
          })
          .catch((err: unknown) => {
            const message =
              err instanceof AttachmentUploadError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : 'Upload failed';
            setAttachments((cur) =>
              cur.map((a) =>
                a.localId === localId
                  ? { ...a, status: 'error', error: message }
                  : a,
              ),
            );
          });
      }
      return [...prev, ...accepted];
    });
  }

  function removeAttachment(localId: string) {
    // V1 simplicity per CONTEXT: orphan uploads are acceptable. We drop the
    // chip from local state but do NOT issue a DELETE — per-tenant storage
    // quotas (Phase 18 backlog) will reclaim.
    setAttachments((cur) => cur.filter((a) => a.localId !== localId));
  }

  function handlePaperclipClick() {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input so picking the same file twice still fires onChange.
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragActive) setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only deactivate if leaving the outer container, not entering a child.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleSend() {
    if (!canSend) return;
    const attachmentIds = attachments
      .filter((a) => a.status === 'ready' && a.artifactId)
      .map((a) => a.artifactId as string);

    sendMessage.mutate(
      {
        runId,
        content: input.trim(),
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        ...(isStudio && targetAgent ? { targetAgent } : {}),
        ...(isStudio ? { metadata: { verbosity } } : {}),
      },
      {
        onSuccess: () => {
          setInput('');
          setTargetAgent(null);
          setAttachments([]);
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

  const attachmentsAtMax = attachments.length >= MAX_FILES_PER_MESSAGE;

  return (
    <div
      className={`sticky bottom-0 z-20 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        dragActive ? 'ring-2 ring-amber-500/50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input — driven by the Paperclip button below. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden
      />

      {/* Transient validation error banner (auto-clears after 4s). */}
      {validationError && (
        <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400">
          {validationError}
        </div>
      )}

      {/* Pending-attachment chip stack — only renders when we have attachments. */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.localId}
              localId={a.localId}
              filename={a.file.name}
              sizeBytes={a.file.size}
              status={a.status}
              error={a.error}
              onRemove={removeAttachment}
            />
          ))}
        </div>
      )}

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
          {/* Improve prompt — secondary, ghost style. Disabled when input is empty. */}
          <Button
            ref={improveButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImproveOpen(true)}
            disabled={!input.trim() || isCancelled || isPlanned}
            aria-label="Improve prompt"
            title="Improve prompt"
          >
            <Sparkles className="size-4" />
          </Button>

          {/* Phase 17-01: paperclip — between Improve and Stop/Send per CONTEXT. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePaperclipClick}
            disabled={isCancelled || isPlanned || attachmentsAtMax}
            aria-label="Attach files"
            title={
              attachmentsAtMax
                ? `Max ${MAX_FILES_PER_MESSAGE} files per message`
                : 'Attach files (PDF, DOCX, images, text — up to 20 MB each)'
            }
          >
            <Paperclip className="size-4" />
          </Button>

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

      <ImprovePromptPopover
        open={improveOpen}
        draft={input}
        anchor={improveButtonRef.current}
        onUseRewrite={(text) => {
          setInput(text);
          setImproveOpen(false);
          textareaRef.current?.focus();
        }}
        onEditAndKeep={(text) => {
          setInput(text);
          setImproveOpen(false);
          textareaRef.current?.focus();
        }}
        onClose={() => setImproveOpen(false)}
      />
    </div>
  );
}
