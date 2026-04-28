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
 *     <extracted text or "(image — included with this message)">
 *     [2] screenshot.png (PNG, 38 KB)
 *     (image — included with this message)
 *     --- END ATTACHMENTS ---
 *
 * Body-line precedence per attachment:
 *   1. extractedText non-null  → emit it raw on the next line
 *   2. mimeType starts with 'image/'  → emit `(image — included with this message)`
 *   3. otherwise  → emit `(no extracted text available)`
 *
 * Trailing whitespace: the block ends with `--- END ATTACHMENTS ---` followed
 * by exactly two newlines (`\n\n`) so the user content begins on its own line
 * with a clean visual separator.
 *
 * V1 simplification per PATTERNS.md: this builder runs in the web app, NOT
 * the agent-hub. The hub's `RunStartBody` schema is unchanged — it just sees
 * a longer prompt string. Image base64 pass-through (which DOES require hub
 * changes) is explicitly deferred.
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
    if (r.extractedText) {
      lines.push(r.extractedText);
    } else if (r.mimeType.startsWith('image/')) {
      // Exact wording from CONTEXT.md — Mo/Jarvis/Herman pattern-match on
      // this string in the prompt to know they're being shown an image they
      // can't read directly (V1 ships text-only; image-via-CLI-bridge is
      // deferred to a future track).
      lines.push('(image — included with this message)');
    } else {
      lines.push('(no extracted text available)');
    }
  });
  lines.push('--- END ATTACHMENTS ---');
  return lines.join('\n') + '\n\n';
}
