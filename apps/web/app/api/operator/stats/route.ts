import { NextResponse } from 'next/server';
import { requireOperatorApi } from '@/lib/operator';
import { db, tenants, createTenantSchema } from '@beagle-console/db';
import { sql, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  const op = await requireOperatorApi();
  if (!op) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // Tenant count
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    const tenantCount = allTenants.length;

    // Active runs across all tenants
    let activeRunsCount = 0;
    const activeStatuses = ['executing', 'approved', 'planned', 'pending'];

    for (const t of allTenants) {
      const { runs } = createTenantSchema(t.id);
      try {
        const activeRuns = await db
          .select({ id: runs.id })
          .from(runs)
          .where(inArray(runs.status, activeStatuses));
        activeRunsCount += activeRuns.length;
      } catch {
        // Schema may not exist yet for newly provisioned tenants
      }
    }

    // Cost: query cost events in last 24h/7d/30d
    // Phase A: return 0 if no cost events exist yet
    const cost = { last24h: 0, last7d: 0, last30d: 0 };

    for (const t of allTenants) {
      const { events } = createTenantSchema(t.id);
      try {
        const costEvents = await db
          .select({ content: events.content, createdAt: events.createdAt })
          .from(events)
          .where(sql`${events.type} = 'cost_update' AND ${events.createdAt} > now() - interval '30 days'`);

        for (const ev of costEvents) {
          const amount = (ev.content as Record<string, unknown>)?.amount;
          const cost_val = typeof amount === 'number' ? amount : 0;
          const age = Date.now() - new Date(ev.createdAt).getTime();
          const DAY = 86400000;
          if (age < DAY) cost.last24h += cost_val;
          if (age < 7 * DAY) cost.last7d += cost_val;
          cost.last30d += cost_val;
        }
      } catch {
        // Schema may not exist yet
      }
    }

    return NextResponse.json({ tenantCount, activeRunsCount, cost });
  } catch (err) {
    console.error('GET /api/operator/stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
