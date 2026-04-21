import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/beagle_console';

// Single shared connection pool, 20-30 connections (per D-11)
// DO NOT create pool-per-tenant -- will OOM the VPS
const queryClient = postgres(connectionString, { max: 25 });

export const db = drizzle(queryClient);
export { queryClient };
