import { NextResponse } from 'next/server';
import { requireOperatorApi } from '@/lib/operator';
import { db, tenants, createTenantSchema } from '@beagle-console/db';
import { notInArray, desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  const op = await requireOperatorApi();
  if (!op) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const allTenants = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants);

    const allRuns: {
      tenantName: string;
      tenantSlug: string;
      projectName: string | null;
      runId: string;
      status: string;
      createdAt: Date;
      prompt: string | null;
    }[] = [];

    for (const t of allTenants) {
      const { runs, projects } = createTenantSchema(t.id);
      try {
        const rows = await db
          .select({
            runId: runs.id,
            status: runs.status,
            createdAt: runs.createdAt,
            prompt: runs.prompt,
            projectName: projects.name,
          })
          .from(runs)
          .leftJoin(projects, eq(runs.projectId, projects.id))
          .where(notInArray(runs.status, ['completed', 'cancelled']))
          .orderBy(desc(runs.createdAt))
          .limit(100);

        for (const row of rows) {
          allRuns.push({
            tenantName: t.name,
            tenantSlug: t.slug,
            projectName: row.projectName,
            runId: row.runId,
            status: row.status,
            createdAt: row.createdAt,
            prompt: row.prompt,
          });
        }
      } catch {
        // Schema may not exist yet for newly provisioned tenants
      }
    }

    // Sort by createdAt desc across all tenants, limit 100
    allRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allRuns.slice(0, 100));
  } catch (err) {
    console.error('GET /api/operator/runs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
