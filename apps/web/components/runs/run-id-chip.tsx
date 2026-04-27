'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Returns the run-id "short slug" — first 8 chars of the UUID prefixed with `#`.
 * For inputs shorter than 8 chars (defensive — should never happen in production
 * since runIds are UUIDs), returns whatever was provided. The empty-string case
 * returns `#` so the chip is never blank.
 */
export function shortSlug(runId: string): string {
  return `#${runId.slice(0, 8)}`;
}

interface RunIdChipProps {
  runId: string;
  className?: string;
}

/**
 * Click-to-copy chip showing `#xxxxxxxx` (first 8 chars of UUID).
 *
 * - Renders the slug in a monospaced font, theme-aware text color.
 * - On click: copies the FULL UUID to clipboard and flips text to
 *   "Run ID copied" for 1500ms before reverting.
 * - The full UUID is also accessible via the `title` attribute, mirroring
 *   the run-page title h1 hover-tooltip pattern from Plan 12-04.
 *
 * Per CONTEXT.md Item 5: re-uses the inline-state copy pattern used by
 * share-link confirmations. NO toast library — the project does not depend
 * on sonner or react-hot-toast.
 */
export function RunIdChip({ runId, className }: RunIdChipProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (older browser, insecure context) — silently
      // fail. The user can still read the full UUID from the title attribute.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={runId}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
      aria-label={copied ? 'Run ID copied' : `Copy run id ${runId}`}
    >
      {copied ? 'Run ID copied' : shortSlug(runId)}
    </button>
  );
}
