import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { eq } from 'drizzle-orm';
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
import { hubClient } from '@/lib/api/hub-client';

export const runtime = 'nodejs';

const AnswerBody = z.object({
  answer: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; qid: string }> },
) {
  try {
    const { session, tenantId } = await requireTenantContext();
    const { id: runId, qid } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);

    const body = await request.json();
    const { answer } = AnswerBody.parse(body);

    // Fetch question (tenant-scoped via getTenantDb)
    const [question] = await tdb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.id, qid))
      .limit(1);

    if (!question || question.runId !== runId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (question.answer !== null) {
      return NextResponse.json({ error: 'Question already answered' }, { status: 409 });
    }

    // Update question with answer
    await tdb
      .update(schema.questions)
      .set({
        answer,
        answeredAt: new Date(),
        answeredBy: session.user.id,
      })
      .where(eq(schema.questions.id, qid));

    // Forward answer to Hub -> asking agent
    await hubClient.answerQuestion({
      runId,
      tenantId,
      questionId: qid,
      answer,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/runs/[id]/questions/[qid]/answer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
