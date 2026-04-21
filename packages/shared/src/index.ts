import { z } from 'zod/v4';

export const RunStatus = z.enum([
  'pending',
  'planned',
  'approved',
  'executing',
  'completed',
  'cancelled',
]);

export type RunStatus = z.infer<typeof RunStatus>;

export const AgentName = z.enum(['mo', 'jarvis', 'sentinel', 'user']);

export type AgentName = z.infer<typeof AgentName>;
