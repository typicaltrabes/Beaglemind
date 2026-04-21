import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { tenantId } = await requireTenantContext();
  const { id } = await params;
  const { db: tdb, schema } = getTenantDb(tenantId);

  // Validate share link belongs to this tenant (T-08-10)
  const [link] = await tdb
    .select({ id: schema.shareLinks.id })
    .from(schema.shareLinks)
    .where(eq(schema.shareLinks.id, id))
    .limit(1);

  if (!link) {
    return Response.json({ error: 'Share link not found' }, { status: 404 });
  }

  const views = await tdb
    .select({
      viewerIp: schema.replayViews.viewerIp,
      userAgent: schema.replayViews.userAgent,
      viewedAt: schema.replayViews.viewedAt,
    })
    .from(schema.replayViews)
    .where(eq(schema.replayViews.shareLinkId, id))
    .orderBy(desc(schema.replayViews.viewedAt))
    .limit(100);

  return Response.json(views);
}
