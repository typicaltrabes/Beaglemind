import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/shared.ts',
  out: './migrations/shared',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/beagle_console',
  },
});
