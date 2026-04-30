import { z } from 'zod/v4';

// D-06: Message types for Hub events
export const MessageType = z.enum([
  'agent_message',
  'plan_proposal',
  'question',
  'artifact',
  'state_transition',
  'system',
  'tldr_update',
  'sentinel_flag',
  // Phase 19-03 (UX-19-05): per-agent presence indicators. v1 emits only
  // _start and _end around each bridge call; _typing is reserved for a
  // future streaming-bridge that knows when a token-stream begins.
  'presence_thinking_start',
  'presence_thinking_end',
  'presence_typing',
]);

// Scene metadata convention (set by Mo on events):
//   metadata.sceneId: string — groups events into scenes
//   metadata.sceneName: string — human-readable scene label
// tldr_update content convention:
//   content.summary: string — running TLDR text for the banner

export type MessageType = z.infer<typeof MessageType>;

// D-05: Standard JSON message envelope for all Hub communication
export const HubEventEnvelope = z.object({
  type: MessageType,
  agentId: z.string(),
  runId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sequenceNumber: z.number().int().positive(),
  content: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export type HubEventEnvelope = z.infer<typeof HubEventEnvelope>;

// OpenClaw WebSocket plugin inbound message types
export const OpenClawInbound = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat.typing') }),
  z.object({
    type: z.literal('chat.stream'),
    messageId: z.string(),
    content: z.string(),
    done: z.boolean(),
  }),
  z.object({
    type: z.literal('chat.response'),
    messageId: z.string(),
    content: z.string(),
    done: z.literal(true),
  }),
  z.object({
    type: z.literal('chat.error'),
    messageId: z.string().optional(),
    error: z.string(),
  }),
]);

export type OpenClawInbound = z.infer<typeof OpenClawInbound>;

// OpenClaw WebSocket plugin outbound message type (Hub -> Agent)
export const OpenClawOutbound = z.object({
  type: z.literal('chat.send'),
  content: z.string(),
  messageId: z.string(),
  senderId: z.string(),
  senderName: z.literal('Console Hub'),
  chatType: z.literal('direct'),
  customData: z.object({
    runId: z.string(),
    tenantId: z.string(),
  }).catchall(z.unknown()),
});

export type OpenClawOutbound = z.infer<typeof OpenClawOutbound>;
