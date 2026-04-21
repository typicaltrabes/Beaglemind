#!/usr/bin/env tsx
/**
 * CLI entrypoint for tenant provisioning.
 *
 * Usage:
 *   pnpm --filter @beagle-console/db run provision-tenant -- \
 *     --name "Acme Corp" --email admin@acme.com --password secret123
 *
 * Wraps provisionTenantWithAuth() with a standalone Better Auth instance
 * (no Next.js cookie handling needed for server-side provisioning).
 */

import { parseArgs } from 'node:util';
import { betterAuth } from 'better-auth';
import { organization, twoFactor } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../client';
import * as authSchema from '../schema/auth-schema';
import { provisionTenantWithAuth } from '../provision-tenant';

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function printUsage() {
  console.log(`
Usage: provision-tenant [options]

Required:
  --name        Tenant name (e.g. "Acme Corp")
  --email       Admin user email
  --password    Admin user password

Optional:
  --admin-name  Admin display name (defaults to email username)
  --slug        Tenant slug (defaults to kebab-case of name)
  --vault-path  Vault path for secrets
  --help        Show this help message
`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
      'admin-name': { type: 'string' },
      slug: { type: 'string' },
      'vault-path': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!values.name || !values.email || !values.password) {
    console.error('Error: --name, --email, and --password are required.\n');
    printUsage();
    process.exit(1);
  }

  const slug = values.slug ?? toKebabCase(values.name);
  const adminName = values['admin-name'] ?? values.email.split('@')[0]!;
  const vaultPath = values['vault-path'];

  // Create a standalone Better Auth instance for provisioning.
  // Same config as apps/web/lib/auth.ts but without nextCookies plugin
  // (not running inside Next.js).
  const authInstance = betterAuth({
    appName: 'Beagle Agent Console',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false, // Allow signup during provisioning
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: false,
        creatorRole: 'owner',
      }),
      twoFactor({
        issuer: 'Beagle Agent Console',
        totpOptions: { digits: 6, period: 30 },
        backupCodeOptions: { amount: 10, length: 8 },
      }),
    ],
  });

  console.log(`Provisioning tenant "${values.name}" (slug: ${slug})...`);

  const result = await provisionTenantWithAuth(
    {
      name: values.name,
      slug,
      vaultPath,
      adminEmail: values.email,
      adminPassword: values.password,
      adminName,
    },
    authInstance,
  );

  console.log('\nProvisioning complete:');
  console.log(`  Tenant ID:  ${result.tenant.id}`);
  console.log(`  Org ID:     ${result.organizationId}`);
  console.log(`  Admin User: ${result.userId}`);
}

main().catch((err) => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
