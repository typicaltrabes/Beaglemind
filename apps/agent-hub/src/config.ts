import { z } from 'zod/v4';

const EnvSchema = z.object({
  AGENT_MO_URL: z.string().url().optional(),
  AGENT_SAM_URL: z.string().url().optional(),
  AGENT_HERMAN_URL: z.string().url().optional(),
  AGENT_JARVIS_URL: z.string().url().optional(),
  AGENT_JARVIS_TOKEN: z.string().optional(),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PING_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  PONG_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  // OpenClaw's WebSocket protocol requires device pairing (v3 challenge/response).
  // The Hub can't complete it, so connections thrash every ~10s. Messaging goes
  // through the CLI bridge instead. Default off until someone implements pairing.
  AGENT_HUB_WS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

const parsed = EnvSchema.parse(process.env);

// Build agent list from available env vars. When WS is disabled we still keep
// the env vars around (compose expects them) but hand the registry an empty
// list so it never opens a socket.
const agents: Array<{ id: string; url: string; token?: string }> = [];
if (parsed.AGENT_HUB_WS_ENABLED) {
  if (parsed.AGENT_MO_URL) agents.push({ id: 'mo', url: parsed.AGENT_MO_URL });
  if (parsed.AGENT_SAM_URL) agents.push({ id: 'sam', url: parsed.AGENT_SAM_URL });
  if (parsed.AGENT_HERMAN_URL) agents.push({ id: 'herman', url: parsed.AGENT_HERMAN_URL });
  if (parsed.AGENT_JARVIS_URL) agents.push({ id: 'jarvis', url: parsed.AGENT_JARVIS_URL, token: parsed.AGENT_JARVIS_TOKEN });
}

export const config = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  pingIntervalMs: parsed.PING_INTERVAL_MS,
  pongTimeoutMs: parsed.PONG_TIMEOUT_MS,
  wsEnabled: parsed.AGENT_HUB_WS_ENABLED,
  agents,
};

export type AgentConfig = (typeof config.agents)[number];
