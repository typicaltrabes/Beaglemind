import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 3001);

const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Agent Hub starting on port ${PORT}`);
});
