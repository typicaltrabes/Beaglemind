import { NextResponse } from 'next/server';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { sql, and, type SQL } from 'drizzle-orm';

export const runtime = 'nodejs';

const AGENT_REGEX = /^[a-z0-9_-]{1,32}$/i;

/**
 * GET /api/runs/history/summary
 *
 * Returns the four KPI metrics used by the Run History page's <RunHistorySummary />
 * tile strip. Tenant-scoped via `requireTenantContext()` + `getTenantDb()`.
 *
 * Optional `?agent=<id>` query param filters runs to those that involved the
 * given agent — same regex validation + EXISTS-subquery pattern as
 * apps/web/app/api/runs/history/route.ts (Plan 16-02).
 *
 * Response shape:
 *   {
 *     totalRuns: number,
 *     totalSpendUsd: number,   // sum of events.metadata->>'costUsd' across in-scope runs
 *     avgCostUsd: number,      // totalSpendUsd / completedRuns (0 when no completed)
 *     completedToday: number   // runs.status='completed' AND updatedAt >= start-of-today UTC
 *   }
 */
export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    const url = new URL(request.url);
    const agentParam = url.searchParams.get('agent');
    const agentFilter =
      agentParam && AGENT_REGEX.test(agentParam) ? agentParam.toLowerCase() : null;

    // Optional agent EXISTS filter — same pattern as
    // apps/web/app/api/runs/history/route.ts (Plan 16-02 addition).
    const conditions: SQL[] = [];
    if (agentFilter) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${schema.events}
          WHERE ${schema.events.runId} = ${schema.runs.id}
            AND lower(${schema.events.agentId}) = ${agentFilter}
        )`,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Rolling 24-hour window for "Completed Today" — UTC midnight cutoff
    // produced misleading numbers for ET-zone users (an event completing at
    // 23:00 ET disappeared from "today" 1 hour later when UTC rolled over).
    // Now: any run completed in the last 24 hours, regardless of UTC date.
    const last24hCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Single SELECT with subqueries:
    //   1) totalRuns      = count(*) of runs in scope.
    //   2) totalSpendUsd  = sum of events.metadata->>'costUsd' across runs in scope.
    //   3) completedRuns  = runs.status='completed' (used to derive avgCostUsd).
    //   4) completedToday = runs.status='completed' AND updatedAt >= start-of-today.
    // Cardinality of the result is 1 row; tenant runs table is bounded.
    const [row] = await tdb
      .select({
        totalRuns: sql<number>`count(*)::int`,
        // When agent filter is active, sum ONLY that agent's costs across the
        // in-scope runs (not the full per-run total which would include the
        // other agents' costs from those same runs). When unfiltered, sum
        // every event's cost across all in-scope runs.
        totalSpendUsd: sql<number>`coalesce((
          SELECT sum((${schema.events.metadata}->>'costUsd')::numeric)
          FROM ${schema.events}
          WHERE ${schema.events.runId} IN (
            SELECT ${schema.runs.id} FROM ${schema.runs} ${where ? sql`WHERE ${where}` : sql``}
          )
            AND ${schema.events.metadata}->>'costUsd' IS NOT NULL
            ${agentFilter ? sql`AND lower(${schema.events.agentId}) = ${agentFilter}` : sql``}
        ), 0)::float8`,
        completedRuns: sql<number>`sum(case when ${schema.runs.status} = 'completed' then 1 else 0 end)::int`,
        completedToday: sql<number>`sum(case when ${schema.runs.status} = 'completed' and ${schema.runs.updatedAt} >= ${last24hCutoff.toISOString()} then 1 else 0 end)::int`,
      })
      .from(schema.runs)
      .where(where);

    const totalRuns = Number(row?.totalRuns ?? 0);
    const totalSpendUsd = Number(row?.totalSpendUsd ?? 0);
    const completedRuns = Number(row?.completedRuns ?? 0);
    const completedToday = Number(row?.completedToday ?? 0);
    const avgCostUsd = completedRuns > 0 ? totalSpendUsd / completedRuns : 0;

    return NextResponse.json(
      {
        totalRuns,
        totalSpendUsd,
        avgCostUsd,
        completedToday,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('GET /api/runs/history/summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
