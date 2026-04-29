import mammoth from 'mammoth';
import Anthropic from '@anthropic-ai/sdk';

export const EXTRACT_CAP = 50_000;

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TEXT_MIMES = new Set(['text/plain', 'text/markdown']);
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// --- Phase 17.1: vision-API description ----------------------------------
// Server-side image description so weaker, non-vision agents (Herman, future
// open-weight models) still see meaningful image content via the prepended
// `--- USER ATTACHMENTS ---` block. Vision-capable agents receive the actual
// bytes through the CLI bridge (Plan 17.1-03) on TOP of this description.

const VISION_MODEL = 'claude-haiku-4-5-20251001';
const VISION_FALLBACK_MODEL = 'claude-sonnet-4-6';
const VISION_PROMPT =
  "Describe this image factually in 2-4 sentences. Note key visual elements, " +
  "text content if any, and overall composition. Do not interpret or speculate — " +
  "just describe what's visible.";
const MAX_DESCRIPTION_TOKENS = 300;

// Module-singleton: client lazily constructed on first successful call so
// missing-key startup does not throw, only warn-once. Caller-side per-run
// state (request, response) is owned by Anthropic SDK internals.
let visionClient: Anthropic | null = null;
let warnedMissingKey = false;

function getVisionClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (!warnedMissingKey) {
      console.warn(
        'ANTHROPIC_API_KEY missing — image descriptions disabled',
      );
      warnedMissingKey = true;
    }
    return null;
  }
  if (!visionClient) {
    visionClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return visionClient;
}

/**
 * TEST-ONLY: reset the module-level vision-client + warn-once flag so unit
 * tests can run independently regardless of order. Mirrors the
 * `resetRateLimiterForTest` pattern in attachment-upload-rate-limit.ts.
 */
export function _resetClientForTest(): void {
  visionClient = null;
  warnedMissingKey = false;
}

/**
 * Generate a 2-4 sentence factual description of an image via the Anthropic
 * vision API. Returns null for non-image mimes, when ANTHROPIC_API_KEY is
 * missing, or when both Haiku + Sonnet calls fail. The caller (the upload
 * route) must treat null as "no description available" and persist NULL —
 * downstream the attachment block falls back to a placeholder.
 *
 * Failure modes are all silent (warn-only) by design: the upload itself must
 * succeed even if the vision API is down, otherwise the user can't even
 * store the image for later retrieval.
 */
export async function extractImageDescription(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!IMAGE_MIMES.has(mimeType)) return null;
  const client = getVisionClient();
  if (!client) return null;

  const base64 = buffer.toString('base64');
  for (const model of [VISION_MODEL, VISION_FALLBACK_MODEL]) {
    try {
      const res = await client.messages.create({
        model,
        max_tokens: MAX_DESCRIPTION_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  // The IMAGE_MIMES gate above already restricts mimeType to
                  // png/jpeg/webp — exactly the set Anthropic's
                  // Base64ImageSource.media_type accepts. Cast keeps the
                  // SDK's strict union type happy without runtime cost.
                  media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
                  data: base64,
                },
              },
              { type: 'text', text: VISION_PROMPT },
            ],
          },
        ],
      });
      const block = res.content.find(
        (b: { type: string }) => b.type === 'text',
      );
      if (block && block.type === 'text') {
        const text = (block as { text: string }).text.trim();
        if (text) return text;
      }
      // Empty text block (or no text block at all) — treat as "no
      // description". Don't try the fallback model: the call succeeded,
      // the model just chose to return nothing.
      return null;
    } catch (err) {
      console.warn(`extractImageDescription failed on ${model}:`, err);
      // try next model
    }
  }
  return null;
}

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
