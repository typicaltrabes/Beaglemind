import { NextResponse } from 'next/server';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { db, members } from '@beagle-console/db';
import { eq, and, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/audit-log
 * Returns break-glass audit records for the current tenant (D-10, OPER-06).
 * Only accessible to org owners and admins.
 */
export async function GET() {
  try {
    const { session, tenantId } = await requireTenantContext();

    // Check user is owner or admin in their org
    const [member] = await db
      .select({ role: members.role })
      .from(members)
      .where(
        and(
          eq(members.userId, session.user.id),
          eq(members.organizationId, tenantId)
        )
      );

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Only organization owners and admins can view audit logs' },
        { status: 403 }
      );
    }

    const { db: tdb, schema } = getTenantDb(tenantId);

    const records = await tdb
      .select({
        id: schema.breakGlassAudit.id,
        operatorEmail: schema.breakGlassAudit.operatorEmail,
        reason: schema.breakGlassAudit.reason,
        grantedAt: schema.breakGlassAudit.grantedAt,
        expiresAt: schema.breakGlassAudit.expiresAt,
        revokedAt: schema.breakGlassAudit.revokedAt,
      })
      .from(schema.breakGlassAudit)
      .orderBy(desc(schema.breakGlassAudit.grantedAt));

    return NextResponse.json(records);
  } catch (error) {
    console.error('GET /api/audit-log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
