import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 19-02: MessageRouter now reads runs.idle_timeout_minutes and writes
// runs.last_event_at on every persistAndPublish. Mock @beagle-console/db so
// tests can:
//   - control the idle_timeout_minutes returned to the router (drives
//     scheduler.schedule's `minutes` arg)
//   - inspect the .set() payload of the last_event_at update
// `globalThis.__mockIdleMin` controls the select chain's resolved value.
// `(db as any).__updates` accumulates every .set() payload in test order.
vi.mock('@beagle-console/db', () => {
  const updates: any[] = [];
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              const min = (globalThis as any).__mockIdleMin;
              return min === undefined ? [] : [{ idleTimeoutMinutes: min }];
            }),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn(async () => {
            updates.push(vals);
            return undefined;
          }),
        })),
      })),
      __updates: updates,
    },
    createTenantSchema: vi.fn(() => ({
      runs: { id: 'id', idleTimeoutMinutes: 'idleTimeoutMinutes' },
    })),
  };
});

import { mapOpenClawToEvent, MessageRouter } from '../handlers/message-router';
import { db } from '@beagle-console/db';

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
  const TENANT_ID = '00000000-0000-0000-0000-000000000002';
  const RUN_ID = '00000000-0000-0000-0000-000000000001';

  let mockEventStore: { persist: ReturnType<typeof vi.fn> };
  let mockPublisher: { publish: ReturnType<typeof vi.fn> };
  let mockLogger: any;
  let router: MessageRouter;

  beforeEach(() => {
    (db as any).__updates.length = 0;
    (globalThis as any).__mockIdleMin = 7;
    mockEventStore = {
      persist: vi.fn().mockResolvedValue({
        type: 'agent_message',
        agentId: 'mo',
        runId: RUN_ID,
        tenantId: TENANT_ID,
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
        runId: RUN_ID,
        tenantId: TENANT_ID,
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
    }, RUN_ID, TENANT_ID);

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
      }, RUN_ID, TENANT_ID),
    ).rejects.toThrow('DB down');

    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Phase 19-02: idle-timeout watcher reschedule + last_event_at touch
  // ---------------------------------------------------------------------------

  describe('Phase 19-02: idle-timeout watcher integration', () => {
    function makePersistInput(text = 'hi') {
      return {
        type: 'agent_message' as const,
        agentId: 'mo',
        runId: RUN_ID,
        tenantId: TENANT_ID,
        content: { text },
        metadata: {},
      };
    }

    it('reschedules idle-timeout watcher on every persistAndPublish', async () => {
      const scheduleCalls: Array<{ tenantId: string; runId: string; minutes: number }> = [];
      const scheduler = {
        schedule: vi.fn(async (tenantId: string, runId: string, minutes: number) => {
          scheduleCalls.push({ tenantId, runId, minutes });
        }),
      };
      router = new MessageRouter(mockEventStore as any, mockPublisher as any, mockLogger, scheduler);

      // Two back-to-back publishes — scheduler should be called once per
      // publish (the BullMQ-side remove+add idiom collapses them into one
      // pending job at the queue layer; that's the scheduler's concern).
      await router.persistAndPublish(TENANT_ID, makePersistInput('first'));
      await router.persistAndPublish(TENANT_ID, makePersistInput('second'));

      expect(scheduleCalls).toHaveLength(2);
      expect(scheduleCalls[0]).toEqual({ tenantId: TENANT_ID, runId: RUN_ID, minutes: 7 });
      expect(scheduleCalls[1]).toEqual({ tenantId: TENANT_ID, runId: RUN_ID, minutes: 7 });
    });

    it('passes the run-specific idle_timeout_minutes from the runs row', async () => {
      // A run configured with a non-default idleTimeoutMinutes should drive
      // the scheduler's `minutes` arg — confirms the read-from-DB path works.
      (globalThis as any).__mockIdleMin = 12;
      const scheduler = { schedule: vi.fn(async () => {}) };
      router = new MessageRouter(mockEventStore as any, mockPublisher as any, mockLogger, scheduler);

      await router.persistAndPublish(TENANT_ID, makePersistInput());

      expect(scheduler.schedule).toHaveBeenCalledWith(TENANT_ID, RUN_ID, 12);
    });

    it('updates last_event_at on every persistAndPublish', async () => {
      router = new MessageRouter(mockEventStore as any, mockPublisher as any, mockLogger);

      await router.persistAndPublish(TENANT_ID, makePersistInput());

      // Without a scheduler, the only update should be the last_event_at touch.
      expect((db as any).__updates).toHaveLength(1);
      expect((db as any).__updates[0].lastEventAt).toBeInstanceOf(Date);
      expect((db as any).__updates[0].updatedAt).toBeInstanceOf(Date);
    });

    it('does not throw when scheduler is undefined (test/no-Redis path)', async () => {
      router = new MessageRouter(mockEventStore as any, mockPublisher as any, mockLogger);

      // Should complete without errors even though idleScheduler is undefined.
      await expect(router.persistAndPublish(TENANT_ID, makePersistInput())).resolves.toBeDefined();
      expect(mockPublisher.publish).toHaveBeenCalledOnce();
    });

    it('does not roll back the publish if scheduler throws', async () => {
      const scheduler = {
        schedule: vi.fn(async () => {
          throw new Error('redis down');
        }),
      };
      router = new MessageRouter(mockEventStore as any, mockPublisher as any, mockLogger, scheduler);

      // Scheduler error must be swallowed — the publish itself already
      // succeeded and the event row is the source of truth.
      const result = await router.persistAndPublish(TENANT_ID, makePersistInput());

      expect(result).toBeDefined();
      expect(mockPublisher.publish).toHaveBeenCalledOnce();
      expect(scheduler.schedule).toHaveBeenCalledOnce();
      // Error logged via this.log.error
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
