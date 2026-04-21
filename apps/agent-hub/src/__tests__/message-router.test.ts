import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapOpenClawToEvent, MessageRouter } from '../handlers/message-router';

describe('mapOpenClawToEvent', () => {
  const base = { agentId: 'mo', runId: '00000000-0000-0000-0000-000000000001', tenantId: '00000000-0000-0000-0000-000000000002' };

  it('chat.response returns type=agent_message with content.text and metadata.done=true', () => {
    const result = mapOpenClawToEvent(base.agentId, {
      type: 'chat.response' as const,
      messageId: 'msg-1',
      content: 'Hello world',
      done: true as const,
    }, base.runId, base.tenantId);

    expect(result.type).toBe('agent_message');
    expect(result.content).toEqual({ text: 'Hello world' });
    expect(result.metadata).toEqual({ done: true });
    expect(result.agentId).toBe('mo');
  });

  it('chat.stream returns type=agent_message with metadata.streaming=true and metadata.done from message', () => {
    const result = mapOpenClawToEvent(base.agentId, {
      type: 'chat.stream' as const,
      messageId: 'msg-2',
      content: 'partial...',
      done: false,
    }, base.runId, base.tenantId);

    expect(result.type).toBe('agent_message');
    expect(result.content).toEqual({ text: 'partial...' });
    expect(result.metadata).toEqual({ streaming: true, done: false });
  });

  it('chat.typing returns type=system with content.event=typing', () => {
    const result = mapOpenClawToEvent(base.agentId, {
      type: 'chat.typing' as const,
    }, base.runId, base.tenantId);

    expect(result.type).toBe('system');
    expect(result.content).toEqual({ event: 'typing' });
    expect(result.metadata).toEqual({});
  });

  it('chat.error returns type=system with content.event=error and content.error from message', () => {
    const result = mapOpenClawToEvent(base.agentId, {
      type: 'chat.error' as const,
      error: 'Something failed',
    }, base.runId, base.tenantId);

    expect(result.type).toBe('system');
    expect(result.content).toEqual({ event: 'error', error: 'Something failed' });
    expect(result.metadata).toEqual({});
  });
});

describe('MessageRouter', () => {
  let mockEventStore: { persist: ReturnType<typeof vi.fn> };
  let mockPublisher: { publish: ReturnType<typeof vi.fn> };
  let mockLogger: any;
  let router: MessageRouter;

  beforeEach(() => {
    mockEventStore = {
      persist: vi.fn().mockResolvedValue({
        type: 'agent_message',
        agentId: 'mo',
        runId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        sequenceNumber: 1,
        content: { text: 'hello' },
        timestamp: '2026-04-21T00:00:00.000Z',
      }),
    };
    mockPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
    mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    router = new MessageRouter(mockEventStore as any, mockPublisher as any, mockLogger);
  });

  it('persist is called before publish (D-08)', async () => {
    const callOrder: string[] = [];
    mockEventStore.persist.mockImplementation(async () => {
      callOrder.push('persist');
      return {
        type: 'agent_message',
        agentId: 'mo',
        runId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        sequenceNumber: 1,
        content: { text: 'hello' },
        timestamp: '2026-04-21T00:00:00.000Z',
      };
    });
    mockPublisher.publish.mockImplementation(async () => {
      callOrder.push('publish');
    });

    await router.handleAgentMessage('mo', {
      type: 'chat.response',
      messageId: 'msg-1',
      content: 'hello',
      done: true,
    }, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

    expect(callOrder).toEqual(['persist', 'publish']);
  });

  it('drops invalid messages without throwing', async () => {
    await router.handleAgentMessage('mo', { type: 'invalid.garbage', foo: 'bar' }, 'run-1', 'tenant-1');
    expect(mockEventStore.persist).not.toHaveBeenCalled();
    expect(mockPublisher.publish).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('does not publish if persist fails', async () => {
    mockEventStore.persist.mockRejectedValue(new Error('DB down'));

    await expect(
      router.handleAgentMessage('mo', {
        type: 'chat.response',
        messageId: 'msg-1',
        content: 'hello',
        done: true,
      }, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
    ).rejects.toThrow('DB down');

    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });
});
