// Placeholder worker. No BullMQ queues are wired up yet — this process exists
// so `console-worker` has something to run instead of restart-looping.
// Replace the heartbeat with real queue consumers when queues exist.

console.log('Worker starting');
console.log('Worker ready, no queues registered — idling');

const heartbeat = setInterval(() => {}, 60_000);

function shutdown(signal: string) {
  console.log(`Worker shutting down (${signal})`);
  clearInterval(heartbeat);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
