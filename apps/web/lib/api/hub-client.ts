const HUB_URL = process.env.AGENT_HUB_URL ?? 'http://localhost:4100';

async function hubPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${HUB_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Hub ${path} failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  return res.json() as T;
}

export const hubClient = {
  send: (data: { agentId: string; content: string; runId: string; tenantId: string }) =>
    hubPost<{ ok: true }>('/send', data),

  startRun: (data: {
    runId: string;
    tenantId: string;
    prompt: string;
    // Phase 17.1-06 (DEFECT-17-B): when set, the hub sends `agentPrompt` to
    // OpenClaw (round-table input with attachment block + extracted text)
    // while persisting the user event with the clean `prompt`. Optional —
    // omitted callers see no behavior change.
    agentPrompt?: string;
    // Phase 17.1-06: artifact UUIDs included with the user message so the
    // persisted event carries `content.attachmentIds` for chip rendering in
    // the transcript. Capped at 4 hub-side; same cap upstream in the messages
    // route. Empty array or omitted → no chips, existing event shape.
    attachmentIds?: string[];
    /** Phase 17.1-03: image bytes for vision-capable agents. The hub
     *  validates with HubImageAttachment Zod (max 4) and gates by
     *  visionCapable per-agent before forwarding to the CLI bridge. Pure
     *  pass-through — undefined when no images / over the 10 MB budget. */
    imageAttachments?: Array<{
      filename: string;
      mimeType: string;
      base64: string;
    }>;
    targetAgent?: string;
  }) =>
    hubPost<{ ok: true; runId: string }>('/runs/start', data),

  stopRun: (data: { runId: string; tenantId: string }) =>
    hubPost<{ ok: true }>('/runs/stop', data),

  approveRun: (data: { runId: string; tenantId: string }) =>
    hubPost<{ ok: true }>('/runs/approve', data),

  answerQuestion: (data: { runId: string; tenantId: string; questionId: string; answer: string }) =>
    hubPost<{ ok: true }>('/runs/questions/answer', data),
};
