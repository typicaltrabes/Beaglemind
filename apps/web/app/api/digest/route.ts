import { NextResponse } from 'next/server';
import { gt, isNull, desc, eq, sql } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { db, users } from '@beagle-console/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { session, tenantId } = await requireTenantContext();
    const { db: tdb, schema } = getTenantDb(tenantId);
    const userId = session.user.id;

    // Read user's lastActiveAt
    const userRows = await db
      .select({ lastActiveAt: users.lastActiveAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const since = userRows[0]?.lastActiveAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Query tenant data since lastActiveAt
    const [runsProgressed, artifactsDelivered, answeredQuestions, pendingRows] =
      await Promise.all([
        // Runs that progressed
        tdb
          .select({
            id: schema.runs.id,
            projectId: schema.runs.projectId,
            status: schema.runs.status,
            prompt: schema.runs.prompt,
          })
          .from(schema.runs)
          .where(gt(schema.runs.updatedAt, since))
          .orderBy(desc(schema.runs.updatedAt))
          .limit(50),

        // Artifacts delivered
        tdb
          .select({
            id: schema.artifacts.id,
            runId: schema.artifacts.runId,
            filename: schema.artifacts.filename,
            sizeBytes: schema.artifacts.sizeBytes,
          })
          .from(schema.artifacts)
          .where(gt(schema.artifacts.createdAt, since))
          .orderBy(desc(schema.artifacts.createdAt))
          .limit(50),

        // Questions answered
        tdb
          .select({
            id: schema.questions.id,
            runId: schema.questions.runId,
            agentId: schema.questions.agentId,
            content: schema.questions.content,
            answer: schema.questions.answer,
          })
          .from(schema.questions)
          .where(gt(schema.questions.answeredAt, since))
          .orderBy(desc(schema.questions.answeredAt))
          .limit(50),

        // Pending questions count
        tdb
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.questions)
          .where(isNull(schema.questions.answer)),
      ]);

    // Update lastActiveAt to now
    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, userId));

    // Truncate long text fields for the response
    const runs = runsProgressed.map((r) => ({
      ...r,
      prompt: r.prompt && r.prompt.length > 120 ? r.prompt.slice(0, 120) + '...' : r.prompt,
    }));

    const questions = answeredQuestions.map((q) => ({
      ...q,
      content: q.content && q.content.length > 120 ? q.content.slice(0, 120) + '...' : q.content,
      answer: q.answer && q.answer.length > 120 ? q.answer.slice(0, 120) + '...' : q.answer,
    }));

    return NextResponse.json({
      since: since.toISOString(),
      runs,
      artifacts: artifactsDelivered,
      answeredQuestions: questions,
      pendingCount: pendingRows[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('GET /api/digest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
