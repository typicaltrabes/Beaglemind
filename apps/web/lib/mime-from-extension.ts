/**
 * Phase 17.1-05: filename-extension fallback for browser/OS mime gaps.
 *
 * Background (DEFECT-17-A):
 * On Windows, `.md` files (and other text variants) come through with
 * `file.type === ''` because `text/markdown` isn't always registered in the
 * OS MIME database. The composer + upload route used to gate purely on
 * `file.type` against an allowlist, so these uploads were rejected as
 * `Unsupported file type`.
 *
 * This helper centralizes the mapping from filename extension → canonical
 * mime, and a `resolveMime(file)` wrapper that prefers the browser-reported
 * mime when reliable but falls back to extension when the browser/OS reports
 * an empty string or `application/octet-stream`. Used by:
 *   - `apps/web/components/transcript/composer.tsx` (client-side gate)
 *   - `apps/web/app/api/runs/[id]/attachments/route.ts` (server-side gate +
 *     persisted `artifacts.mime_type` value)
 *
 * The set of allowed mimes is unchanged from Phase 17 — this fix only widens
 * detection of the same allowlist, never adds new types.
 */

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
  md: 'text/markdown',
};

/**
 * Canonical allowed mime set — derived from EXT_TO_MIME so the two cannot
 * drift. Importers should prefer this over inlining a hand-maintained Set.
 */
export const ALLOWED_MIMES = new Set<string>(Object.values(EXT_TO_MIME));

/**
 * Map a filename to its canonical mime by inspecting the final extension
 * segment (case-insensitive). Returns null for unsupported / missing
 * extensions. Double extensions like `notes.tar.md` resolve from the FINAL
 * segment (`md` → `text/markdown`).
 */
export function mimeFromExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

/**
 * Browser-reported mime values that we explicitly DO NOT trust and force a
 * filename-extension fallback for. Empty string is the Windows `.md` case;
 * `application/octet-stream` is the generic "I don't know" fallback some
 * browsers/OSes emit for unrecognised types.
 */
const UNRELIABLE_BROWSER_MIMES = new Set(['', 'application/octet-stream']);

/**
 * Resolve the canonical mime for an uploaded file. Prefers the
 * browser-reported `file.type` when it's a recognized allowed mime; falls
 * back to filename extension otherwise. Returns null if neither source
 * resolves to an allowed mime — callers should reject the file in that case.
 */
export function resolveMime(file: { name: string; type: string }): string | null {
  if (!UNRELIABLE_BROWSER_MIMES.has(file.type) && ALLOWED_MIMES.has(file.type)) {
    return file.type;
  }
  return mimeFromExtension(file.name);
}
