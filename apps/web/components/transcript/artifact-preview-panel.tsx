'use client';

import { useEffect, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { XIcon, DownloadIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type PreviewData =
  | { type: 'pdf'; url: string }
  | { type: 'docx'; html: string }
  | { type: 'unsupported' }
  | { type: 'error'; message: string };

interface ArtifactPreviewInlineProps {
  artifactId: string;
  filename: string;
  mimeType: string;
}

/**
 * Inline artifact preview body — SAME fetch/loading/pdf/docx/unsupported logic
 * as the Dialog variant, minus the Dialog wrapper, header bar, and close button.
 *
 * Fetches on mount (and whenever `artifactId` changes); always rendered — no
 * `open` gating. Styled to fill its parent via `h-full w-full` on the outer
 * wrapper.
 *
 * Consumers: ArtifactPreviewPanel (dialog variant — gates mount with `open &&`
 * so fetch only fires when the dialog actually opens), CanvasView (renders
 * directly without a dialog).
 */
export function ArtifactPreviewInline({
  artifactId,
  filename,
  mimeType: _mimeType,
}: ArtifactPreviewInlineProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setPreview(null);
    fetch(`/api/artifacts/${artifactId}/preview`)
      .then((res) => res.json())
      .then((data: PreviewData) => setPreview(data))
      .catch(() =>
        setPreview({ type: 'error', message: 'Failed to load preview' }),
      )
      .finally(() => setLoading(false));
  }, [artifactId]);

  return (
    <div className="flex h-full w-full flex-col">
      {loading && (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {!loading && preview?.type === 'pdf' && (
        <iframe
          src={preview.url}
          className="h-full w-full flex-1"
          title={`Preview of ${filename}`}
        />
      )}

      {!loading && preview?.type === 'docx' && (
        <div
          className="prose prose-invert max-w-none flex-1 overflow-auto p-4"
          dangerouslySetInnerHTML={{ __html: preview.html }}
        />
      )}

      {!loading &&
        (preview?.type === 'unsupported' || preview?.type === 'error') && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {preview.type === 'error'
                ? preview.message
                : 'Preview not available for this file type'}
            </p>
            <Button
              variant="outline"
              size="sm"
              render={
                <a
                  href={`/api/artifacts/${artifactId}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <DownloadIcon data-icon="inline-start" />
              Download instead
            </Button>
          </div>
        )}
    </div>
  );
}

interface ArtifactPreviewPanelProps {
  artifactId: string;
  filename: string;
  mimeType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog-based artifact preview (slide-over panel from the right).
 *
 * Internally reuses `ArtifactPreviewInline` for the body so the fetch + render
 * logic is identical to the Canvas inline path. The inner `<ArtifactPreviewInline />`
 * is gated behind `{open && ...}` so fetch only fires when the dialog opens —
 * this preserves the prior behavior where the preview was fetched on-open, not
 * on-mount.
 */
export function ArtifactPreviewPanel({
  artifactId,
  filename,
  mimeType,
  open,
  onOpenChange,
}: ArtifactPreviewPanelProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            'fixed top-0 right-0 z-50 flex h-full w-full flex-col bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none',
            'duration-300 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right',
            'sm:w-[60%] sm:max-w-3xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-sm font-medium">
                {filename}
              </DialogPrimitive.Title>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={`/api/artifacts/${artifactId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <DownloadIcon data-icon="inline-start" />
                Download
              </Button>
              <DialogPrimitive.Close
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content — gated behind `open` to preserve fetch-on-open behavior */}
          <div className="flex-1 overflow-auto">
            {open && (
              <ArtifactPreviewInline
                artifactId={artifactId}
                filename={filename}
                mimeType={mimeType}
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
