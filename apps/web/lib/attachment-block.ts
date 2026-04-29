/**
 * Phase 17 Track 3 (Plan 17-03): build the structured `--- USER ATTACHMENTS ---`
 * block that gets prepended to a user prompt before the round-table fires.
 *
 * Lives in `apps/web/lib/` (not inline in `route.ts`) because Next.js 15 route
 * files may only export `GET`, `POST`, etc. — any other named export breaks the
 * production type-check. Pulling these helpers into a sibling module both (a)
 * keeps `route.ts` exporting only `POST/GET` and (b) makes the formatting
 * logic unit-testable without spinning up the route.
 *
 * Format (canonical, from CONTEXT.md — do NOT alter the literal sentinels):
 *
 *     --- USER ATTACHMENTS ---
 *     [1] filename.pdf (PDF, 142 KB)
 *     <extracted text>
 *     [2] screenshot.png (PNG, 38 KB)
 *     Description: A dashboard with four KPI cards and a sidebar.
 *     --- END ATTACHMENTS ---
 *
 * Body-line precedence per attachment:
 *   1. mimeType starts with 'image/'
 *      → r.description non-null  → emit `Description: <description>`
 *      → r.description null      → emit `(image attached — description unavailable)`
 *   2. extractedText non-null  → emit it raw on the next line
 *   3. otherwise               → emit `(no extracted text available)`
 *
 * Trailing whitespace: the block ends with `--- END ATTACHMENTS ---` followed
 * by exactly two newlines (`\n\n`) so the user content begins on its own line
 * with a clean visual separator.
 *
 * Phase 17.1 update: the V1 image placeholder `(image — included with this
 * message)` was REPLACED with the vision-API description from the artifacts
 * row (Plan 17.1-01 generates it; Plan 17.1-02 threads it here). Every agent
 * — vision-capable (Mo, Jarvis) AND non-vision (Herman, Sam, future weaker
 * LLMs) — sees the same description floor. Vision-capable agents ALSO receive
 * raw image bytes via the CLI bridge (Plan 17.1-03), but this prompt block is
 * identical for everyone.
 */

import { formatSize } from './format-size';

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WEBP',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
};

/**
 * Map a mime type to a short human-readable label (e.g. "PDF", "PNG").
 * Falls back to the raw mime type for unknown values so nothing silently
 * disappears from the block.
 */
export function mimeLabel(mimeType: string): string {
  return MIME_LABELS[mimeType] ?? mimeType;
}

export interface ArtifactRow {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  description: string | null; // Phase 17.1: vision-API description for images
}

/**
 * Render a list of artifact rows into the canonical attachment block. Returns
 * an empty string for empty input so callers can unconditionally prepend the
 * result without a length check.
 */
export function buildAttachmentBlock(rows: ArtifactRow[]): string {
  if (rows.length === 0) return '';
  const lines: string[] = ['--- USER ATTACHMENTS ---'];
  rows.forEach((r, i) => {
    lines.push(
      `[${i + 1}] ${r.filename} (${mimeLabel(r.mimeType)}, ${formatSize(r.sizeBytes)})`,
    );
    if (r.mimeType.startsWith('image/')) {
      // Phase 17.1: vision-API description (from extractImageDescription) is
      // the floor — every agent (vision-capable or not) sees this textual
      // rendering of the image. Vision-capable agents ALSO receive the
      // image bytes via the CLI bridge in Plan 17.1-03; this prompt block
      // is identical for everyone.
      if (r.description) {
        lines.push(`Description: ${r.description}`);
      } else {
        // Fallback when vision call failed OR row predates 17.1.
        // Exact wording from CONTEXT — do not alter.
        lines.push('(image attached — description unavailable)');
      }
    } else if (r.extractedText) {
      lines.push(r.extractedText);
    } else {
      lines.push('(no extracted text available)');
    }
  });
  lines.push('--- END ATTACHMENTS ---');
  return lines.join('\n') + '\n\n';
}
