import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireTenantContext } from '@/lib/get-tenant';
import { liteLLMComplete, LiteLLMError } from '@/lib/litellm-client';

export const runtime = 'nodejs';

/**
 * System prompt for the prompt-improver tool. Verbatim from CONTEXT.md
 * `<decisions>` Item 3. Tight, single-output, no chain-of-thought.
 */
const IMPROVE_SYSTEM_PROMPT =
  "Rewrite the user's prompt to be clearer, better-structured, and more specific. Keep the user's intent. Do not add new requirements or scope. Output only the rewritten prompt, no preamble or commentary.";

const Body = z.object({
  prompt: z.string().min(1).max(8000),
});

/**
 * Per-user rate limiter (30 requests / 60 seconds).
 *
 * In-memory only — single-process correctness, single-VPS deployment.
 * Per CONTEXT.md `<decisions>` Item 3: "trivially low-cost per call (Haiku,
 * 800 tokens) but add a per-user 30-req/min in-memory limiter to prevent
 * button-spam abuse. Use a simple Map<userId, timestamps[]> in the route file
 * (no Redis — overkill for this)."
 *
 * Exported `__resetRateLimiterForTest` so unit tests can isolate counts.
 */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const userTimestamps = new Map<string, number[]>();

export function __resetRateLimiterForTest() {
  userTimestamps.clear();
}

function rateLimitOk(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = userTimestamps.get(userId) ?? [];
  // Drop timestamps outside the window.
  const recent = arr.filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    // Persist the trimmed list so memory doesn't grow unboundedly.
    userTimestamps.set(userId, recent);
    return false;
  }
  recent.push(now);
  userTimestamps.set(userId, recent);
  return true;
}

export async function POST(request: Request) {
  try {
    const { session } = await requireTenantContext();

    if (!rateLimitOk(session.user.id)) {
      return NextResponse.json(
        { error: 'rate limit exceeded' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { prompt } = Body.parse(body);

    const model = process.env.LITELLM_IMPROVE_MODEL ?? 'claude-haiku';

    let rewritten: string;
    try {
      rewritten = await liteLLMComplete({
        model,
        system: IMPROVE_SYSTEM_PROMPT,
        user: prompt,
        maxTokens: 800,
        temperature: 0.2,
        timeoutMs: 8_000,
      });
    } catch (err) {
      if (err instanceof LiteLLMError && /timeout/i.test(err.message)) {
        return NextResponse.json(
          { error: 'rewrite timed out — try again' },
          { status: 504 },
        );
      }
      console.error('improve-prompt LiteLLM error:', err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }

    return NextResponse.json({ rewritten: rewritten.trim() }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // requireTenantContext redirects throw NEXT_REDIRECT — let them propagate.
    if ((error as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('improve-prompt error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
