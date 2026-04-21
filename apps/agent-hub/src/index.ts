import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config';
import { logger } from './logger';
import { AgentRegistry } from './connections/agent-registry';

const registry = new AgentRegistry(
  config.agents,
  config.pingIntervalMs,
  config.pongTimeoutMs,
  (agentId, data) => {
    // Message handler -- wired to event persistence + Redis in Plan 03
    logger.debug({ agentId, data }, 'Received message from agent');
  },
);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, registry.getHealthStatus());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    sendJson(res, 200, registry.getStatus());
    return;
  }

  // Placeholder endpoints -- wired in Plan 03 (event persistence + Redis bridge)
  if (req.method === 'POST' && url.pathname === '/send') {
    sendJson(res, 501, { error: 'Not implemented — wired in Plan 03' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs/start') {
    sendJson(res, 501, { error: 'Not implemented — wired in Plan 03' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/runs/stop') {
    sendJson(res, 501, { error: 'Not implemented — wired in Plan 03' });
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
