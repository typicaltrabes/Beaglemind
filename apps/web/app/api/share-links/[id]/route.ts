import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId } = await requireTenantContext();
  const { id } = await params;
  const { db: tdb, schema } = getTenantDb(tenantId);

  // Validate share link belongs to this tenant (T-08-03):
  // Join with runs to confirm the run is in tenant schema
  const [existing] = await tdb
    .select({ id: schema.shareLinks.id })
    .from(schema.shareLinks)
    .where(and(eq(schema.shareLinks.id, id), isNull(schema.shareLinks.revokedAt)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Share link not found or already revoked' }, { status: 404 });
  }

  await tdb
    .update(schema.shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(schema.shareLinks.id, id));

  return Response.json({ success: true });
}
