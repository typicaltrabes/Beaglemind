import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config';
import { logger } from './logger';
import { AgentRegistry } from './connections/agent-registry';
import { SequenceCounter } from './events/sequence-counter';
import { EventStore } from './events/event-store';
import { redisPub, closeRedis } from './bridge/redis-client';
import { RedisPublisher } from './bridge/redis-publisher';
import { MessageRouter } from './handlers/message-router';
import { BullMQIdleTimeoutScheduler } from './handlers/idle-timeout-scheduler';
import { handleSend, handleRunStart, handleRunStop, handleRunApprove, handleQuestionAnswer } from './http/routes';
import { db } from '@beagle-console/db';

// --- Event pipeline setup ---

const sequenceCounter = new SequenceCounter();
const eventStore = new EventStore(db, sequenceCounter);
const redisPublisher = new RedisPublisher(redisPub);

// Phase 19-02: idle-timeout watcher scheduler. MessageRouter calls this on
// every event publish to reschedule the BullMQ delayed job that flips the
// run to `completed` after `idle_timeout_minutes` of silence. BullMQ requires
// `maxRetriesPerRequest: null` on the underlying ioredis connection.
const redisUrl = new URL(config.redisUrl);
const idleScheduler = new BullMQIdleTimeoutScheduler({
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null,
});

const messageRouter = new MessageRouter(eventStore, redisPublisher, logger, idleScheduler);

// --- Active run context (single active run at a time) ---

let activeRunId: string | null = null;
let activeTenantId: string | null = null;

function setActiveRun(runId: string, tenantId: string): void {
  activeRunId = runId;
  activeTenantId = tenantId;
  logger.info({ runId, tenantId }, 'Active run set');
}

function clearActiveRun(): void {
  logger.info({ runId: activeRunId }, 'Active run cleared');
  if (activeRunId) {
    sequenceCounter.reset(activeRunId);
  }
  activeRunId = null;
  activeTenantId = null;
}

// --- Agent registry with message routing ---

const registry = new AgentRegistry(
  config.agents,
  config.pingIntervalMs,
  config.pongTimeoutMs,
  (agentId, data) => {
    if (!activeRunId || !activeTenantId) {
      logger.warn({ agentId }, 'Received agent message but no active run, dropping');
      return;
    }
    messageRouter.handleAgentMessage(agentId, data, activeRunId, activeTenantId).catch((err) => {
      logger.error({ err, agentId }, 'Failed to route agent message');
    });
  },
);

// --- HTTP helpers ---

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        resolve(body);
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// --- HTTP server ---

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, registry.getHealthStatus());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    sendJson(res, 200, registry.getStatus());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/send') {
    try {
      const body = await readJsonBody(req);
      const result = await handleSend(body, registry, messageRouter);
      sendJson(res, 200, result);
    } catch (err: any) {
      logger.error({ err, path: '/send' }, 'Error handling /send');
      sendJson(res, err.name === 'ZodError' ? 400 : 500, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs/start') {
    try {
      const body = await readJsonBody(req);
      const result = await handleRunStart(body, registry, messageRouter, setActiveRun, eventStore);
      sendJson(res, 200, result);
    } catch (err: any) {
      logger.error({ err, path: '/runs/start' }, 'Error handling /runs/start');
      sendJson(res, err.name === 'ZodError' ? 400 : 500, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs/stop') {
    try {
      const body = await readJsonBody(req);
      const result = await handleRunStop(body, messageRouter, clearActiveRun);
      sendJson(res, 200, result);
    } catch (err: any) {
      logger.error({ err, path: '/runs/stop' }, 'Error handling /runs/stop');
      sendJson(res, err.name === 'ZodError' ? 400 : 500, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs/approve') {
    try {
      const body = await readJsonBody(req);
      const result = await handleRunApprove(body, registry, messageRouter);
      sendJson(res, 200, result);
    } catch (err: any) {
      logger.error({ err, path: '/runs/approve' }, 'Error handling /runs/approve');
      sendJson(res, err.name === 'ZodError' ? 400 : 500, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs/questions/answer') {
    try {
      const body = await readJsonBody(req);
      const result = await handleQuestionAnswer(body, registry, messageRouter);
      sendJson(res, 200, result);
    } catch (err: any) {
      logger.error({ err, path: '/runs/questions/answer' }, 'Error handling /runs/questions/answer');
      sendJson(res, err.name === 'ZodError' ? 400 : 500, { error: err.message });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      agents: config.agents.map((a) => ({ id: a.id, url: a.url })),
    },
    'Agent Hub started',
  );
  registry.connectAll();
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down Agent Hub');
  registry.closeAll();
  closeRedis().catch((err) => {
    logger.error({ err }, 'Error closing Redis');
  });
  // Phase 19-02: close the BullMQ idle-timeout scheduler queue connection
  idleScheduler.close().catch((err) => {
    logger.error({ err }, 'Error closing idle-timeout scheduler');
  });
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
