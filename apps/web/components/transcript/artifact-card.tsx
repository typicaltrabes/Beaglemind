'use client';

import type { HubEventEnvelope } from '@beagle-console/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ArtifactCardProps {
  event: HubEventEnvelope;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactCard({ event }: ArtifactCardProps) {
  const content = event.content as {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    artifactId: string;
  };

  return (
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
  );
}
