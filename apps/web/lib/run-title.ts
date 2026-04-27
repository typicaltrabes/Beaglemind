import { eq } from 'drizzle-orm';
import { getTenantDb } from '@/lib/get-tenant';
import { liteLLMComplete } from '@/lib/litellm-client';

/**
 * System prompt for the run-title summarizer. Tight, deterministic,
 * single-line output. Per CONTEXT.md `<decisions>` Item 2:
 *   "Summarize this user prompt in 6-8 words for a UI title.
 *    Output only the title, no quotes, no period."
 */
export const RUN_TITLE_SYSTEM_PROMPT =
  "Summarize this user prompt in 6-8 words for a UI title. Output only the title, no quotes, no period.";

/**
 * Truncates a string to at most `max` chars; appends an ellipsis when
 * truncated. Used by both the run-history table and the run page header
 * fallback when no AI title is available yet.
 *
 * Pure function — no side effects. Unit-tested directly.
 */
export function truncatePrompt(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

/**
 * Strips quotes / trailing punctuation that LLMs sometimes emit despite
 * the system prompt. Clamps to 80 chars (matches runs.title VARCHAR(80)
 * column width from Plan 13-01) so we never insert a too-long value.
 */
export function sanitizeTitle(raw: string): string {
  let t = raw.trim();
  // Strip surrounding double or single quotes if present
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  // Strip a single trailing period
  if (t.endsWith('.')) t = t.slice(0, -1).trim();
  // Hard clamp to column width
  if (t.length > 80) t = t.slice(0, 80);
  return t;
}

interface GenerateRunTitleInput {
  runId: string;
  prompt: string;
  tenantId: string;
}

/**
 * Best-effort title generation. Called fire-and-forget (`void generateRunTitle(...)`)
 * from POST /api/runs immediately after the run row is inserted.
 *
 * Behavior:
 *   - Calls LiteLLM with a tight system prompt (10s timeout, max_tokens=64).
 *   - Sanitizes the response (trim, strip quotes, clamp ≤80 chars).
 *   - If sanitized result is non-empty, UPDATEs runs.title for the runId.
 *   - On ANY error (timeout, non-2xx, malformed response, empty result,
 *     DB write error), logs and returns. NEVER throws — callers fire it as
 *     `void` and assume it cannot reject.
 */
export async function generateRunTitle(input: GenerateRunTitleInput): Promise<void> {
  const { runId, prompt, tenantId } = input;

  // Skip empty prompts (defensive — prompt is required by Zod in the route, but
  // a future caller could pass a whitespace-only string).
  if (!prompt.trim()) {
    return;
  }

  try {
    const model = process.env.LITELLM_TITLE_MODEL ?? 'claude-haiku';
    const raw = await liteLLMComplete({
      model,
      system: RUN_TITLE_SYSTEM_PROMPT,
      user: prompt,
      maxTokens: 64,
      temperature: 0.2,
      timeoutMs: 10_000,
    });
    const title = sanitizeTitle(raw);
    if (!title) return;

    const { db: tdb, schema } = getTenantDb(tenantId);
    await tdb
      .update(schema.runs)
      .set({ title })
      .where(eq(schema.runs.id, runId));
  } catch (err) {
    console.error(
      `[generateRunTitle] runId=${runId} tenantId=${tenantId} error:`,
      err,
    );
    // Intentionally swallow — UI falls back to truncated prompt.
  }
}
