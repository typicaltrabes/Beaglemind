import { NextResponse } from 'next/server';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { sql, eq, desc, ilike, inArray, and, or } from 'drizzle-orm';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set([
  'pending',
  'planned',
  'approved',
  'executing',
  'completed',
  'cancelled',
]);

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const limitParam = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
      100
    );
    const offsetParam = Math.max(
      parseInt(url.searchParams.get('offset') ?? '0', 10) || 0,
      0
    );

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];

    // Status filter (validated against whitelist per T-07-05)
    if (statusParam) {
      const statuses = statusParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => VALID_STATUSES.has(s));
      if (statuses.length > 0) {
        conditions.push(inArray(schema.runs.status, statuses));
      }
    }

    // Search filter using parameterized ILIKE (per T-07-05)
    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.projects.name, term),
          ilike(schema.runs.prompt, term)
        )!
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Query runs with joined project name, artifact count, and cost
    const rows = await tdb
      .select({
        id: schema.runs.id,
        projectId: schema.runs.projectId,
        projectName: schema.projects.name,
        prompt: schema.runs.prompt,
        status: schema.runs.status,
        kind: schema.runs.kind,
        createdAt: schema.runs.createdAt,
        updatedAt: schema.runs.updatedAt,
        artifactCount: sql<number>`(
          SELECT count(*)::int FROM ${schema.artifacts}
          WHERE ${schema.artifacts.runId} = ${schema.runs.id}
        )`,
        totalCostUsd: sql<number>`(
          SELECT coalesce(sum((${schema.events.metadata}->>'costUsd')::numeric), 0)
          FROM ${schema.events}
          WHERE ${schema.events.runId} = ${schema.runs.id}
            AND ${schema.events.metadata}->>'costUsd' IS NOT NULL
        )`,
      })
      .from(schema.runs)
      .leftJoin(schema.projects, eq(schema.runs.projectId, schema.projects.id))
      .where(whereClause)
      .orderBy(desc(schema.runs.createdAt))
      .limit(limitParam)
      .offset(offsetParam);

    // Count total for pagination
    const countResult = await tdb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.runs)
      .leftJoin(schema.projects, eq(schema.runs.projectId, schema.projects.id))
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    // Compute duration for completed/cancelled runs
    const runs = rows.map((row) => {
      let durationSeconds: number | null = null;
      if (
        (row.status === 'completed' || row.status === 'cancelled') &&
        row.updatedAt &&
        row.createdAt
      ) {
        durationSeconds = Math.round(
          (new Date(row.updatedAt).getTime() -
            new Date(row.createdAt).getTime()) /
            1000
        );
      }
      return {
        ...row,
        totalCostUsd: Number(row.totalCostUsd) || 0,
        durationSeconds,
      };
    });

    return NextResponse.json({ runs, total });
  } catch (error) {
    console.error('GET /api/runs/history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
