'use client';

import { useState } from 'react';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EyeIcon } from 'lucide-react';
import { ArtifactPreviewPanel } from './artifact-preview-panel';
import { formatSize } from '@/lib/format-size';

interface ArtifactCardProps {
  event: HubEventEnvelope;
}

export const PREVIEWABLE_MIMES = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function ArtifactCard({ event }: ArtifactCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const content = event.content as {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    artifactId: string;
  };

  const canPreview = PREVIEWABLE_MIMES.has(content.mimeType);

  return (
    <>
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {content.filename}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatSize(content.sizeBytes)}
            </p>
          </div>

          {canPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              <EyeIcon data-icon="inline-start" />
              View
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={`/api/artifacts/${content.artifactId}/download`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Download
          </Button>
        </CardContent>
      </Card>

      {canPreview && (
        <ArtifactPreviewPanel
          artifactId={content.artifactId}
          filename={content.filename}
          mimeType={content.mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </>
  );
}
