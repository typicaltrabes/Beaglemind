import { NextResponse } from 'next/server';
import { requireOperatorApi } from '@/lib/operator';
import { db } from '@beagle-console/db';
import { getMinioClient } from '@beagle-console/db';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

interface ServiceHealth {
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}

async function checkPostgres(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkMinio(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const client = getMinioClient();
    await client.send(new ListBucketsCommand({}));
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkHub(): Promise<ServiceHealth & { agents?: unknown[] }> {
  const start = Date.now();
  const hubUrl = process.env.AGENT_HUB_URL ?? 'http://localhost:4100';
  try {
    const res = await fetch(`${hubUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return { status: 'ok', latencyMs: Date.now() - start, agents: data.agents };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function GET() {
  const op = await requireOperatorApi();
  if (!op) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [postgres, redis, minio, hub] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMinio(),
    checkHub(),
  ]);

  return NextResponse.json({ postgres, redis, minio, hub });
}
