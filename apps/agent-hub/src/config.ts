import { z } from 'zod/v4';

const EnvSchema = z.object({
  AGENT_MO_URL: z.string().url(),
  AGENT_SAM_URL: z.string().url(),
  AGENT_HERMAN_URL: z.string().url(),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PING_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  PONG_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

const parsed = EnvSchema.parse(process.env);

export const config = {
  port: parsed.PORT,
  logLevel: parsed.LOG_LEVEL,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  pingIntervalMs: parsed.PING_INTERVAL_MS,
  pongTimeoutMs: parsed.PONG_TIMEOUT_MS,
  agents: [
    { id: 'mo', url: parsed.AGENT_MO_URL },
    { id: 'sam', url: parsed.AGENT_SAM_URL },
    { id: 'herman', url: parsed.AGENT_HERMAN_URL },
  ],
} as const;

export type AgentConfig = (typeof config.agents)[number];
