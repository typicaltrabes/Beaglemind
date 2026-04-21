import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { eq, asc, gt, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId } = await requireTenantContext();
  const { id: runId } = await params;
  const encoder = new TextEncoder();

  // Last-Event-ID for reconnection gap-fill
  const lastEventId = request.headers.get('Last-Event-ID');

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (eventId: string, data: string) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`id: ${eventId}\ndata: ${data}\n\n`),
        );
      };

      const replay = async () => {
        const { db: tdb, schema } = getTenantDb(tenantId);

        // Replay from DB: all events or only after lastEventId (reconnection)
        const conditions = lastEventId
          ? and(
              eq(schema.events.runId, runId),
              gt(schema.events.sequenceNumber, parseInt(lastEventId, 10)),
            )
          : eq(schema.events.runId, runId);

        const events = await tdb
          .select()
          .from(schema.events)
          .where(conditions)
          .orderBy(asc(schema.events.sequenceNumber));

        for (const event of events) {
          send(String(event.sequenceNumber), JSON.stringify(event));
        }

        // Subscribe to Redis for real-time events (T-04-06: channel from authenticated tenantId)
        const Redis = (await import('ioredis')).default;
        const subscriber = new Redis(
          process.env.REDIS_URL ?? 'redis://localhost:6379',
        );
        const channel = `run:${tenantId}:${runId}`;
        await subscriber.subscribe(channel);

        subscriber.on('message', (_ch: string, message: string) => {
          try {
            const parsed = JSON.parse(message);
            send(String(parsed.sequenceNumber), message);
          } catch {
            // Skip malformed messages
          }
        });

        // Heartbeat every 30s to keep connection alive through proxies
        const heartbeat = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 30_000);

        // Cleanup on client disconnect via request.signal abort
        request.signal.addEventListener('abort', () => {
          closed = true;
          clearInterval(heartbeat);
          subscriber.unsubscribe(channel).then(() => subscriber.quit()).catch(() => {});
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      };

      // Do NOT await -- let Response return immediately (critical SSE pattern)
      replay().catch((err) => {
        console.error('SSE replay error:', err);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
