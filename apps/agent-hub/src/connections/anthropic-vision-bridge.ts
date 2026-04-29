import Anthropic from '@anthropic-ai/sdk';
import { createChildLogger } from '../logger';
import { getPersona } from '../personas/persona-loader';

const log = createChildLogger({ component: 'anthropic-vision-bridge' });

// Opus only per project preference (Haiku hallucinated badly in agent role
// per prior incident). Description extraction in apps/web/lib/extract-attachment
// uses Haiku because that's a constrained "describe this image" task — this
// path is the agent itself responding, so it gets Opus.
const VISION_MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 1500;

const SUPPORTED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export interface VisionBridgeConfig {
  agentId: string;
  runId: string;
}

export interface VisionImage {
  filename: string;
  mimeType: string;
  base64: string;
}

/**
 * Vision pass-through path: bypasses the OpenClaw CLI bridge (which has no
 * image flag) and calls Anthropic Messages API directly with the image as a
 * content block. The agent's SOUL.md is loaded as the system prompt so the
 * persona/voice carries through.
 *
 * Tradeoff: this turn does NOT write to the agent's OpenClaw session memory.
 * Memory continuity for vision turns is a follow-up — for now, future text
 * turns will see the user message + description (already in the prompt block
 * via the round-table) but not the agent's own pixel-aware reply. Workaround:
 * the agent's reply persists in the console DB and is fed back as PRIOR
 * CONVERSATION on the NEXT user message via the 17.1-07 history loader.
 */
export async function sendToAgentWithVision(
  cfg: VisionBridgeConfig,
  fullPrompt: string,
  images: VisionImage[],
): Promise<{
  text: string;
  runId: string;
  durationMs: number;
  costUsd: number;
  model: string;
} | null> {
  const c = getClient();
  if (!c) {
    log.error({ agentId: cfg.agentId }, 'ANTHROPIC_API_KEY not set; vision bridge unavailable');
    return null;
  }

  const persona = await getPersona(cfg.agentId);
  if (!persona) {
    log.error({ agentId: cfg.agentId }, 'persona not loadable; cannot run vision bridge');
    return null;
  }

  const validImages = images.filter((img) => SUPPORTED_MIMES.has(img.mimeType));
  if (validImages.length === 0) {
    log.warn(
      { agentId: cfg.agentId, count: images.length },
      'no supported image MIME types in attachments — vision bridge skipped',
    );
    return null;
  }

  const startedAt = Date.now();

  const userContent: Anthropic.ContentBlockParam[] = [
    ...validImages.map(
      (img) =>
        ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
            data: img.base64,
          },
        }) as const,
    ),
    { type: 'text', text: fullPrompt } as const,
  ];

  log.info(
    {
      agentId: cfg.agentId,
      runId: cfg.runId,
      imageCount: validImages.length,
      promptLength: fullPrompt.length,
    },
    'Calling Anthropic Messages API with vision content',
  );

  try {
    const res = await c.messages.create({
      model: VISION_MODEL,
      max_tokens: MAX_TOKENS,
      system: persona,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const durationMs = Date.now() - startedAt;
    const inputTokens =
      (res.usage.input_tokens ?? 0) +
      (res.usage.cache_read_input_tokens ?? 0) +
      (res.usage.cache_creation_input_tokens ?? 0);
    const outputTokens = res.usage.output_tokens ?? 0;
    // Opus pricing: $15/M input, $75/M output
    const costUsd = (inputTokens * 15 + outputTokens * 75) / 1_000_000;

    log.info(
      {
        agentId: cfg.agentId,
        responseLength: text.length,
        durationMs,
        costUsd: costUsd.toFixed(4),
      },
      'Vision bridge agent responded',
    );

    return { text, runId: cfg.runId, durationMs, costUsd, model: VISION_MODEL };
  } catch (err: any) {
    log.error(
      { agentId: cfg.agentId, error: err.message },
      'Anthropic vision call failed',
    );
    return null;
  }
}
