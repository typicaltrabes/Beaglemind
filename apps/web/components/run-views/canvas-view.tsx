'use client';

import { useEffect, useState } from 'react';
import { useRunStore } from '@/lib/stores/run-store';
import { getAgentColor } from '@/lib/agent-colors';
import { getAgentConfig } from '@/lib/agent-config';
import {
  selectProximityComments,
  type ProximityComment,
} from '@/lib/canvas-utils';
import { ArtifactPreviewInline } from '@/components/transcript/artifact-preview-panel';
import { PREVIEWABLE_MIMES } from '@/components/transcript/artifact-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRun } from '@/lib/hooks/use-run';
import { truncatePrompt } from '@/lib/run-title';
import { EmptyState } from './empty-state';

interface CanvasViewProps {
  runId: string;
}

type ArtifactContent = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  artifactId: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Canvas view (VIEW-03): artifact-first document surface.
 *
 * Layout:
 *   - ≥768px: two-pane flex row — preview (70% via flex-[7]) | comment rail
 *     (30% via flex-[3])
 *   - <768px: preview stacks on top of the comment rail
 *
 * Artifact selector:
 *   - 0 artifacts → empty state
 *   - 1 artifact → auto-selected, no pill strip
 *   - >1 artifacts → pill strip of filenames at the top
 *
 * Preview pane:
 *   - PREVIEWABLE_MIMES (pdf, docx) render inline via ArtifactPreviewInline
 *   - Non-previewable types show filename + size + Download link only
 *
 * Comment rail:
 *   - 5 agent_message events closest to the selected artifact by
 *     sequenceNumber (via selectProximityComments), labeled before/at/after
 *   - PURELY proximity-based — no parsing of message text for artifact refs
 *     (per 11-CONTEXT.md §Canvas view)
 */
export function CanvasView({ runId }: CanvasViewProps) {
  const artifacts = useRunStore((s) => s.artifacts);
  const messages = useRunStore((s) => s.messages);
  const { data: run } = useRun(runId);

  const firstArtifactId = artifacts[0]
    ? (artifacts[0].content as ArtifactContent).artifactId
    : null;
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    firstArtifactId,
  );

  // Re-sync selection if artifacts arrive after mount, or if the selected
  // artifact id is no longer present.
  useEffect(() => {
    if (!firstArtifactId) return;
    const present = artifacts.some(
      (a) => (a.content as ArtifactContent).artifactId === selectedArtifactId,
    );
    if (!selectedArtifactId || !present) {
      setSelectedArtifactId(firstArtifactId);
    }
  }, [artifacts, firstArtifactId, selectedArtifactId]);

  if (artifacts.length === 0) {
    const promptOrTitle =
      (run?.title ?? '').trim() ||
      truncatePrompt((run?.prompt ?? '').trim(), 120);
    return (
      <EmptyState
        title="Canvas: deliverables view"
        body={
          <>
            <p>This run has no artifacts yet.</p>
            <p className="mt-2">
              Canvas surfaces documents, code, and data the agents produce, with related
              discussion shown in the margins.
            </p>
          </>
        }
        footer={
          promptOrTitle ? (
            <>
              <span className="text-muted-foreground">Run prompt:</span>{' '}
              <span className="text-foreground">&ldquo;{promptOrTitle}&rdquo;</span>
            </>
          ) : null
        }
      />
    );
  }

  const selected =
    artifacts.find(
      (a) => (a.content as ArtifactContent).artifactId === selectedArtifactId,
    ) ?? artifacts[0]!;
  const selectedContent = selected.content as ArtifactContent;
  const canPreview = PREVIEWABLE_MIMES.has(selectedContent.mimeType);
  const comments: ProximityComment[] = selectProximityComments(
    selected.sequenceNumber,
    messages,
    5,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {artifacts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-2">
          {artifacts.map((a) => {
            const c = a.content as ArtifactContent;
            const isActive = c.artifactId === selectedContent.artifactId;
            return (
              <button
                key={c.artifactId}
                type="button"
                onClick={() => setSelectedArtifactId(c.artifactId)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition',
                  isActive
                    ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                    : 'border-white/10 text-muted-foreground hover:text-foreground',
                )}
              >
                {c.filename}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Preview pane (70% on desktop) */}
        <div className="flex flex-[7] min-h-0 flex-col border-b border-white/10 md:border-b-0 md:border-r">
          {canPreview ? (
            <ArtifactPreviewInline
              artifactId={selectedContent.artifactId}
              filename={selectedContent.filename}
              mimeType={selectedContent.mimeType}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {selectedContent.filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatSize(selectedContent.sizeBytes)}
              </p>
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={`/api/artifacts/${selectedContent.artifactId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Download
              </Button>
            </div>
          )}
        </div>

        {/* Comment rail (30% on desktop) */}
        <div className="flex-[3] min-h-0 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No nearby agent commentary
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {comments.map(({ event, position }) => {
                const cfg = getAgentConfig(event.agentId);
                const text =
                  (event.content as { text?: string }).text ?? '';
                return (
                  <li key={event.sequenceNumber} className="px-3 py-2">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`inline-block size-2 rounded-full ${getAgentColor(event.agentId)}`}
                        aria-hidden
                      />
                      <span className="text-xs font-medium text-foreground">
                        {cfg.displayName}
                      </span>
                      <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {position}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                      {text.slice(0, 160)}
                      {text.length > 160 ? '…' : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
