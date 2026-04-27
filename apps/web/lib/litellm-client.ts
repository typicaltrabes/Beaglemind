/**
 * Tiny HTTP wrapper around the LiteLLM Chat Completions endpoint.
 *
 * Used for non-streaming, single-string-output use cases (run title gen,
 * improve-prompt rewrite). NOT a general-purpose LLM client — chooses
 * defaults that keep this file <100 lines.
 *
 * Why hand-rolled instead of pulling in the OpenAI SDK:
 *   - The SDK's WHATWG-stream handling adds bundle weight and lifecycle
 *     complexity for our one-shot text use cases.
 *   - LiteLLM is OpenAI-compatible at the wire level; a fetch wrapper is
 *     20 lines and matches the existing pattern in lib/api/hub-client.ts.
 *
 * Mirrors hubClient's shape: env URL fallback, throws on non-2xx,
 * parses JSON. Adds AbortController-based timeout because upstream LLM
 * calls can stall.
 */

const LITELLM_URL = process.env.LITELLM_URL ?? 'https://litellm.beaglemind.ai';
const LITELLM_KEY = process.env.LITELLM_KEY;

export class LiteLLMError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LiteLLMError';
    this.cause = cause;
  }
}

interface LiteLLMCompleteInput {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;     // default 64 (run title is ~10 tokens; improve-prompt overrides to 800)
  temperature?: number;   // default 0.2 (low — we want deterministic completions)
  timeoutMs?: number;     // default 10000
}

/**
 * Calls LiteLLM /v1/chat/completions with a system+user prompt pair and
 * returns the assistant message content as a raw string. The caller is
 * responsible for trimming, parsing, or otherwise post-processing.
 */
export async function liteLLMComplete(input: LiteLLMCompleteInput): Promise<string> {
  const {
    model,
    system,
    user,
    maxTokens = 64,
    temperature = 0.2,
    timeoutMs = 10_000,
  } = input;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (LITELLM_KEY) {
      headers.Authorization = `Bearer ${LITELLM_KEY}`;
    }

    const res = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new LiteLLMError(
        `LiteLLM ${model} failed: HTTP ${res.status} ${res.statusText} ${errBody.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new LiteLLMError(
        `LiteLLM ${model} returned malformed response: missing choices[0].message.content`,
      );
    }
    return content;
  } catch (err) {
    if (err instanceof LiteLLMError) throw err;
    if ((err as { name?: string }).name === 'AbortError') {
      throw new LiteLLMError(`LiteLLM ${model} timeout after ${timeoutMs}ms`, err);
    }
    throw new LiteLLMError(`LiteLLM ${model} request failed`, err);
  } finally {
    clearTimeout(timer);
  }
}
