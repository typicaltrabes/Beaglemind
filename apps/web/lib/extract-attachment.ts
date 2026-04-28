import mammoth from 'mammoth';

export const EXTRACT_CAP = 50_000;

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TEXT_MIMES = new Set(['text/plain', 'text/markdown']);
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Extract plain text from an uploaded attachment buffer.
 *
 * Returns null for images (vision models read the bytes directly via base64
 * pass-through, not via this helper), for unrecognized mime types, and on
 * any extraction failure (logged at warn level — the caller still uploads
 * the file successfully so the user can download it).
 *
 * Output is capped at EXTRACT_CAP characters with a truncation marker.
 *
 * Implementation notes:
 *  - We dynamic-import pdf-parse from its `lib/pdf-parse.js` subpath rather
 *    than the package root. The root entry `index.js` has a debug-mode
 *    auto-load that tries to read `./test/data/05-versions-space.pdf` at
 *    require time, which crashes outside the package's own working dir.
 *  - We pass `new Uint8Array(buffer)` rather than the raw Node Buffer.
 *    pdf-parse 1.1.1 bundles pdfjs v1.10.100 whose XRef parser misreads
 *    Node 20+ Buffers (returns "bad XRef entry") — Uint8Array works
 *    cleanly across Node versions.
 */
export async function extractAttachment(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  try {
    let text: string | null = null;
    if (mimeType === PDF_MIME) {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const result = await pdfParse(new Uint8Array(buffer));
      text = result.text;
    } else if (mimeType === DOCX_MIME) {
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (TEXT_MIMES.has(mimeType)) {
      text = buffer.toString('utf-8');
    } else if (IMAGE_MIMES.has(mimeType)) {
      return null;
    } else {
      return null;
    }
    if (text && text.length > EXTRACT_CAP) {
      text =
        text.slice(0, EXTRACT_CAP) +
        `\n\n[... truncated, original ${buffer.length} bytes ...]`;
    }
    return text;
  } catch (err) {
    console.warn('extractAttachment failed:', err);
    return null;
  }
}
