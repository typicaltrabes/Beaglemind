// Inject fake env vars BEFORE any test module imports `../config`. The
// hub's config.ts validates process.env at module-load time via Zod, so
// any test that transitively imports routes.ts / logger.ts / push-service.ts
// would otherwise crash at import.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
