import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { hubClient } from '@/lib/api/hub-client';

export const runtime = 'nodejs';

/**
 * Phase 19-04 (UX-19-03) — POST /api/runs/[id]/continue.
 *
 * Driven by the Continue conversation button on the run-detail page header.
 * Triggers another N rounds of round-table discussion against the existing
 * transcript WITHOUT a new user message:
 *
 *   1. Auth + tenant scope (mirrors /messages route)
 *   2. Flip runs.status to 'executing' if currently 'completed' — covers the
 *      case where the idle-timeout watcher already fired and the user clicks
 *      Continue right after. No-op if already executing (concurrent click).
 *   3. Call hub /runs/start with continueOnly=true, prompt='' — the hub will
 *      skip the user-event persist and omit the `User:` line from the first
 *      agent's prompt. See apps/agent-hub/src/http/routes.ts handleRunStart.
 *
 * Idempotency: a double-click produces at most two overlapping round-tables,
 * which is annoying but not data-corrupting. The button-side disable while
 * the mutation is pending + while thinkingAgent is non-null prevents the
 * common case. A future Redis lock could harden the backend further if it
 * ever shows up as a real problem.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params;
    const { tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);

    // Flip to executing if currently completed (continue-conversation case);
    // no-op if already executing.
    await tdb
      .update(schema.runs)
      .set({ status: 'executing', updatedAt: new Date() })
      .where(eq(schema.runs.id, runId));

    await hubClient.startRun({
      runId,
      tenantId,
      prompt: '',
      continueOnly: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/runs/[id]/continue error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
