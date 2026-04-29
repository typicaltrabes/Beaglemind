/**
 * Phase 17.1-06 (DEFECT-17-B) — UserMessageAttachments.
 *
 * Renders attachment chips below a user message bubble. Lucas's WhatsApp-
 * style transcript fix: a PDF / image / MD attachment never dumps its
 * extracted content into the bubble; instead the bubble shows the user's
 * text and this component renders one chip per attachment.
 *
 * Rendering rules:
 *   - mimeType.startsWith('image/') → inline <img> with the download URL,
 *     loading="lazy", capped at max-h-60. Click opens the full image in a
 *     new tab.
 *   - everything else → reuse the existing ArtifactCard (PDF/DOCX get a
 *     View button; everything else gets Download only — handled inside
 *     ArtifactCard via PREVIEWABLE_MIMES).
 */

'use client';

import type { HubEventEnvelope } from '@beagle-console/shared';
import { ArtifactCard } from './artifact-card';
import { useArtifactMetadata } from '@/lib/use-artifact-metadata';

interface Props {
  attachmentIds: string[];
}

export function UserMessageAttachments({ attachmentIds }: Props) {
  const { metadata, loading, error } = useArtifactMetadata(attachmentIds);

  // Empty input → render nothing (no spacing, no chrome). Critical so older
  // user events without attachmentIds don't introduce a visual regression.
  if (attachmentIds.length === 0) return null;

  if (loading) {
    return (
      <div className="mt-2 text-xs text-muted-foreground">
        Loading attachments…
      </div>
    );
  }

  if (error) {
    return <div className="mt-2 text-xs text-red-500">{error}</div>;
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {metadata.map((m) => {
        if (m.mimeType.startsWith('image/')) {
          // Phase 18-01: ?inline=1 → server returns Content-Disposition: inline
          // so click-to-fullsize opens in a new tab instead of forcing download.
          const inlineUrl = `/api/artifacts/${m.id}/download?inline=1`;
          return (
            <a
              key={m.id}
              href={inlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-sm"
            >
              <img
                src={inlineUrl}
                alt={m.filename}
                loading="lazy"
                className="max-h-60 rounded-md border border-border object-contain"
              />
            </a>
          );
        }
        // Reuse ArtifactCard for documents — it already handles PDF preview
        // (iframe), DOCX preview (mammoth → HTML), and Download for
        // everything else. We synthesize the event-shaped content object
        // ArtifactCard expects from the metadata fields we have.
        const fakeEvent = {
          content: {
            filename: m.filename,
            mimeType: m.mimeType,
            sizeBytes: m.sizeBytes,
            artifactId: m.id,
          },
        } as unknown as HubEventEnvelope;
        return <ArtifactCard key={m.id} event={fakeEvent} />;
      })}
    </div>
  );
}
