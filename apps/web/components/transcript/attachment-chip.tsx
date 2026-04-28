'use client';

import { Loader2, Check, AlertCircle, X } from 'lucide-react';
import { formatSize } from '@/lib/format-size';

export type AttachmentStatus = 'uploading' | 'ready' | 'error';

interface AttachmentChipProps {
  localId: string;
  filename: string;
  sizeBytes: number;
  status: AttachmentStatus;
  error?: string;
  onRemove: (localId: string) => void;
}

const TRUNCATE_LEN = 24;

/**
 * Truncate a filename to ~24 chars while preserving the extension when
 * the extension is short enough to fit. Falls back to a plain
 * head-slice + ellipsis for unusual names (no extension, or extensions
 * longer than 6 chars where preserving the suffix wastes the budget).
 */
function truncateFilename(name: string): string {
  if (name.length <= TRUNCATE_LEN) return name;
  const dot = name.lastIndexOf('.');
  if (dot < 0 || name.length - dot > 6) {
    return name.slice(0, TRUNCATE_LEN - 1) + '…';
  }
  const ext = name.slice(dot);
  const base = name.slice(0, dot);
  return base.slice(0, TRUNCATE_LEN - ext.length - 1) + '…' + ext;
}

/**
 * Single pending-attachment chip shown above the composer textarea.
 * Mirrors the @-mention badge JSX in composer.tsx but uses `rounded-md`
 * (not `rounded-full`) per Phase 17 CONTEXT — the visual differentiator
 * between agent-targeting chips (round) and file-attachment chips
 * (square-ish).
 */
export function AttachmentChip({
  localId,
  filename,
  sizeBytes,
  status,
  error,
  onRemove,
}: AttachmentChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-xs"
      title={error ?? filename}
      data-status={status}
    >
      {status === 'uploading' && (
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      )}
      {status === 'ready' && <Check className="size-3 text-emerald-500" />}
      {status === 'error' && (
        <AlertCircle className="size-3 text-red-500" />
      )}
      <span className="text-foreground">{truncateFilename(filename)}</span>
      <span className="text-muted-foreground">{formatSize(sizeBytes)}</span>
      <button
        type="button"
        onClick={() => onRemove(localId)}
        aria-label={`Remove ${filename}`}
        className="ml-0.5 cursor-pointer rounded-md p-0.5 hover:bg-white/10"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
