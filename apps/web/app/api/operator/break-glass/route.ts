import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireOperator } from '@/lib/operator';
import { db, tenants, createTenantSchema } from '@beagle-console/db';
import { eq, and, gt, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

const CreateBreakGlassBody = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

/**
 * POST /api/operator/break-glass
 * Create a break-glass session with 4-hour time-boxed access (D-09).
 */
export async function POST(request: Request) {
  try {
    const { session } = await requireOperator();

    const body = await request.json();
    const { tenantId, reason } = CreateBreakGlassBody.parse(body);

    // Validate tenant exists
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { db: tdb, schema } = getTenantDb(tenantId);
    const now = new Date();

    // Check no active session already exists for this operator + tenant
    const [existing] = await tdb
      .select({ id: schema.breakGlassAudit.id })
      .from(schema.breakGlassAudit)
      .where(
        and(
          eq(schema.breakGlassAudit.operatorId, session.user.id),
          gt(schema.breakGlassAudit.expiresAt, now),
          isNull(schema.breakGlassAudit.revokedAt)
        )
      );

    if (existing) {
      return NextResponse.json(
        { error: 'Active break-glass session already exists for this tenant' },
        { status: 409 }
      );
    }

    const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

    const [record] = await tdb
      .insert(schema.breakGlassAudit)
      .values({
        operatorId: session.user.id,
        operatorEmail: session.user.email,
        reason,
        grantedAt: now,
        expiresAt,
      })
      .returning({
        id: schema.breakGlassAudit.id,
        grantedAt: schema.breakGlassAudit.grantedAt,
        expiresAt: schema.breakGlassAudit.expiresAt,
      });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/operator/break-glass error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/operator/break-glass
 * List active break-glass sessions for the current operator.
 */
export async function GET() {
  try {
    const { session } = await requireOperator();
    const now = new Date();

    // Get all tenants
    const allTenants = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants);

    const activeSessions: Array<{
      tenantId: string;
      tenantName: string;
      reason: string;
      grantedAt: Date;
      expiresAt: Date;
    }> = [];

    for (const t of allTenants) {
      const { db: tdb, schema } = getTenantDb(t.id);
      const records = await tdb
        .select({
          reason: schema.breakGlassAudit.reason,
          grantedAt: schema.breakGlassAudit.grantedAt,
          expiresAt: schema.breakGlassAudit.expiresAt,
        })
        .from(schema.breakGlassAudit)
        .where(
          and(
            eq(schema.breakGlassAudit.operatorId, session.user.id),
            gt(schema.breakGlassAudit.expiresAt, now),
            isNull(schema.breakGlassAudit.revokedAt)
          )
        );

      for (const r of records) {
        activeSessions.push({
          tenantId: t.id,
          tenantName: t.name,
          reason: r.reason,
          grantedAt: r.grantedAt,
          expiresAt: r.expiresAt,
        });
      }
    }

    return NextResponse.json(activeSessions);
  } catch (error) {
    console.error('GET /api/operator/break-glass error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getTenantDb(tenantId: string) {
  const schema = createTenantSchema(tenantId);
  return { db, schema };
}
