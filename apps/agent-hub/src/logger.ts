import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
