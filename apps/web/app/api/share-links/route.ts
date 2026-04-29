import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { session, tenantId } = await requireTenantContext();
  const { db: tdb, schema } = getTenantDb(tenantId);

  const body = await request.json();
  const { runId, expiresInDays = 30 } = body as {
    runId: string;
    expiresInDays?: number;
  };

  if (!runId) {
    return Response.json({ error: 'runId is required' }, { status: 400 });
  }

  // Validate run exists in this tenant (T-08-04)
  const [run] = await tdb
    .select({ id: schema.runs.id })
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);

  if (!run) {
    return Response.json({ error: 'Run not found' }, { status: 404 });
  }

  // Generate 32-byte hex token (T-08-02: 256 bits entropy)
  const token = randomBytes(32).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const rows = await tdb
    .insert(schema.shareLinks)
    .values({
      runId,
      token,
      createdBy: session.user.id,
      expiresAt,
    })
    .returning();

  const shareLink = rows[0]!;
  // Phase 18-02: prefer NEXT_PUBLIC_APP_URL when set, else derive from the
  // incoming request origin. Previous version returned `undefined/replay/...`
  // when the env var wasn't set, which it isn't on prod.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const url = `${origin}/replay/${token}`;

  return Response.json(
    { id: shareLink.id, token: shareLink.token, url, expiresAt: shareLink.expiresAt },
    { status: 201 },
  );
}

export async function GET() {
  const { tenantId } = await requireTenantContext();
  const { db: tdb, schema } = getTenantDb(tenantId);

  const links = await tdb
    .select({
      id: schema.shareLinks.id,
      runId: schema.shareLinks.runId,
      token: schema.shareLinks.token,
      createdBy: schema.shareLinks.createdBy,
      expiresAt: schema.shareLinks.expiresAt,
      revokedAt: schema.shareLinks.revokedAt,
      createdAt: schema.shareLinks.createdAt,
    })
    .from(schema.shareLinks);

  return Response.json(links);
}
