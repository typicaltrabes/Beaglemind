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

  startRun: (data: { runId: string; tenantId: string; prompt: string; targetAgent?: string }) =>
    hubPost<{ ok: true; runId: string }>('/runs/start', data),

  stopRun: (data: { runId: string; tenantId: string }) =>
    hubPost<{ ok: true }>('/runs/stop', data),

  approveRun: (data: { runId: string; tenantId: string }) =>
    hubPost<{ ok: true }>('/runs/approve', data),

  answerQuestion: (data: { runId: string; tenantId: string; questionId: string; answer: string }) =>
    hubPost<{ ok: true }>('/runs/questions/answer', data),
};
