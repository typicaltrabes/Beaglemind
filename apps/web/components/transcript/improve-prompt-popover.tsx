'use client';

import { useEffect, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ImprovePromptPopoverProps {
  /** Whether the popover is open. Parent owns the state. */
  open: boolean;
  /** The composer's current text — shown read-only at top. */
  draft: string;
  /** Element to anchor the popover above. The parent passes the Improve button ref's `.current`. */
  anchor: HTMLElement | null;
  /** "Use rewrite" — caller replaces the composer with the textarea text and closes. */
  onUseRewrite: (text: string) => void;
  /** "Edit and keep" — same as Use rewrite (replaces composer with textarea text) but the user
   *  intends to keep editing. Caller may treat them identically; we expose two callbacks so the
   *  parent can decide. */
  onEditAndKeep: (text: string) => void;
  /** "Cancel" / external close. Composer text is left untouched. */
  onClose: () => void;
}

/**
 * Popover that calls /api/runs/improve-prompt when opened with a non-empty
 * draft, then shows the rewrite in an editable textarea with three actions.
 *
 * State machine:
 *   - open=false → renders nothing (no fetch).
 *   - open=true + draft non-empty → fetches POST /api/runs/improve-prompt.
 *     While in flight: textarea shows centered spinner, action buttons disabled.
 *   - on success → textarea pre-filled with rewrite. User can edit it.
 *   - on error → textarea shows the error message in muted style. Use rewrite
 *     and Edit and keep are disabled; only Cancel works.
 *
 * Per CONTEXT.md `<decisions>` Item 3 layout: Original (read-only) on top,
 * Improved (suggested) editable textarea below, three buttons in a row.
 *
 * Anchor strategy: base-ui's `Popover.Positioner` accepts an `anchor` prop
 * (Element | RefObject) so we can anchor to a button rendered OUTSIDE the
 * Popover.Root tree. The composer owns the Improve button; we just point the
 * positioner at its DOM node.
 */
export function ImprovePromptPopover({
  open,
  draft,
  anchor,
  onUseRewrite,
  onEditAndKeep,
  onClose,
}: ImprovePromptPopoverProps) {
  const [rewritten, setRewritten] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger fetch when the popover opens.
  useEffect(() => {
    if (!open) return;
    if (!draft.trim()) {
      setError('Type something first');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRewritten('');

    fetch('/api/runs/improve-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: draft }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`);
          return;
        }
        setRewritten(typeof data.rewritten === 'string' ? data.rewritten : '');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Request failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, draft]);

  // Reset on close so the next open is a fresh request.
  useEffect(() => {
    if (!open) {
      setRewritten('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const canCommit = !loading && !error && rewritten.trim().length > 0;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="top"
          align="end"
          sideOffset={8}
        >
          <Popover.Popup className="z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-card p-4 shadow-xl outline-none">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Original
                </label>
                <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/5 bg-muted/30 p-2 text-xs text-muted-foreground">
                  {draft || <span className="italic">(empty)</span>}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Improved (suggested)
                </label>
                <div className="relative mt-1">
                  <Textarea
                    value={loading ? '' : rewritten}
                    onChange={(e) => setRewritten(e.target.value)}
                    disabled={loading || Boolean(error)}
                    rows={5}
                    className="min-h-[100px] resize-none text-sm"
                  />
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-card/70">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {error && (
                    <p className="mt-1 text-xs text-red-400">{error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canCommit}
                  onClick={() => onEditAndKeep(rewritten)}
                >
                  Edit and keep
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  disabled={!canCommit}
                  onClick={() => onUseRewrite(rewritten)}
                >
                  Use rewrite
                </Button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
