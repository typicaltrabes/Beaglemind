/**
 * Phase 17.1-06 (DEFECT-17-B) — useArtifactMetadata hook.
 *
 * Fetches artifact metadata (filename, mime, size) by id from
 * GET /api/artifacts/[id] and caches the result in a module-level Map for
 * the rest of the session. Used by UserMessageAttachments to decide between
 * inline-image rendering and ArtifactCard.
 *
 * Cache rationale: an attachment id appears once in a user message, but the
 * transcript can re-render the same message many times during a session
 * (filtering, scroll virtualisation, tab switches). A per-session cache
 * keeps the GET to one round-trip per id without bringing react-query
 * into a small read-only surface.
 */

'use client';

import { useEffect, useState } from 'react';

export interface ArtifactMeta {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

const cache = new Map<string, ArtifactMeta>();

export function useArtifactMetadata(ids: string[]): {
  metadata: ArtifactMeta[];
  loading: boolean;
  error: string | null;
} {
  const initial = ids
    .map((id) => cache.get(id))
    .filter((m): m is ArtifactMeta => Boolean(m));
  const [metadata, setMetadata] = useState<ArtifactMeta[]>(initial);
  const [loading, setLoading] = useState(metadata.length !== ids.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const missing = ids.filter((id) => !cache.has(id));
    if (missing.length === 0) {
      // All ids already cached — sync state in case the inputs changed.
      setMetadata(
        ids
          .map((id) => cache.get(id))
          .filter((m): m is ArtifactMeta => Boolean(m)),
      );
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all(
      missing.map((id) =>
        fetch(`/api/artifacts/${id}`).then((res) => {
          if (!res.ok) throw new Error(`Failed to load artifact ${id}`);
          return res.json() as Promise<ArtifactMeta>;
        }),
      ),
    )
      .then((fetched) => {
        if (cancelled) return;
        for (const m of fetched) cache.set(m.id, m);
        setMetadata(
          ids
            .map((id) => cache.get(id))
            .filter((m): m is ArtifactMeta => Boolean(m)),
        );
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load attachment metadata',
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // ids is a new array reference each render — depend on its joined-id
    // signature to avoid an infinite re-fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return { metadata, loading, error };
}

/**
 * Test helper — clears the module-level cache between test runs so fixtures
 * don't leak across describe blocks. Not exported in production usage.
 */
export function _resetArtifactMetadataCacheForTest(): void {
  cache.clear();
}
