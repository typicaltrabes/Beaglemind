import { NextResponse } from 'next/server';
import { requireOperatorApi } from '@/lib/operator';
import { db, tenants, createTenantSchema } from '@beagle-console/db';
import { desc, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  const op = await requireOperatorApi();
  if (!op) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const allTenants = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants);

    const allFlags: {
      tenantName: string;
      runId: string;
      text: string;
      severity: string;
      timestamp: Date;
      agentId: string;
    }[] = [];

    for (const t of allTenants) {
      const { events } = createTenantSchema(t.id);
      try {
        const rows = await db
          .select({
            runId: events.runId,
            type: events.type,
            agentId: events.agentId,
            content: events.content,
            metadata: events.metadata,
            createdAt: events.createdAt,
          })
          .from(events)
          .where(
            sql`${events.type} = 'sentinel_flag' OR (${events.type} = 'system' AND (${events.content}->>'source') = 'sentinel')`
          )
          .orderBy(desc(events.createdAt))
          .limit(200);

        for (const row of rows) {
          const content = row.content as Record<string, unknown>;
          const metadata = row.metadata as Record<string, unknown> | null;
          allFlags.push({
            tenantName: t.name,
            runId: row.runId,
            text: typeof content.text === 'string' ? content.text : 'Sentinel flag',
            severity: (metadata?.severity as string) ?? 'info',
            timestamp: row.createdAt,
            agentId: row.agentId,
          });
        }
      } catch {
        // Schema may not exist yet
      }
    }

    // Sort by timestamp desc across all tenants, limit 200
    allFlags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(allFlags.slice(0, 200));
  } catch (err) {
    console.error('GET /api/operator/sentinel error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
