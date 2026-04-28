/**
 * Human-readable byte size formatter.
 *
 * Single source of truth (Phase 17): previously duplicated inline in
 * `apps/web/components/transcript/artifact-card.tsx`. Both the post-send
 * `ArtifactCard` and the pending `AttachmentChip` import this helper so
 * the same file shows the same size string at every lifecycle stage.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
