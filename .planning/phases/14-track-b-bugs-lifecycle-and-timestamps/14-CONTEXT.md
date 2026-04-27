# Phase 14: Track B Bugs — Run Lifecycle + Timestamps — Context

**Gathered:** 2026-04-27
**Status:** Ready for planning
**Source:** Bug investigation done in-session by Claude on 2026-04-27 against the live BeagleHQ database. Root causes confirmed via code reading and DB queries. Three real bugs, one false alarm.

<domain>
## Phase Boundary

Three bugs that have been visible in production since at least 2026-04-22, surfaced first in Lucas's Phase 11 UAT (2026-04-27 morning) as "Track B" and explicitly deferred from Phase 12 to keep that scope focused on look-and-feel. Now closing them.

**Bug 1 — NaN:NaN timestamps in transcript (UAT-14-01).**
Every agent message in a historical run renders its timestamp as `NaN:NaN`. Confirmed root cause: the SSE replay endpoint (`apps/web/app/api/runs/[id]/stream/route.ts`) reads events from Postgres and emits the raw row via `JSON.stringify(event)`. The DB row has `createdAt` (Postgres `timestamp with time zone`) but no `timestamp` column. The client `AgentMessage` (`components/transcript/agent-message.tsx`) calls `formatRelativeTime(event.timestamp)`, gets `undefined`, falls into the older-than-24h branch, and `new Date(undefined).getHours()` returns `NaN`. Live (real-time) events go through the hub which sets `timestamp: new Date().toISOString()` in `apps/agent-hub/src/events/event-store.ts:29`, so the bug ONLY shows on the first paint after page reload, not on freshly-streamed events — but every existing run shows it because all those events came from the DB replay path.

**Bug 2 — Runs stuck on `executing` forever (UAT-14-02).**
Confirmed counts on production today: 18 `pending`, 11 `executing`, 1 `completed` (out of 30 total runs in the Hanseatic tenant). The Hub round-table in `apps/agent-hub/src/http/routes.ts:200-215` iterates each agent, logs `Round-table discussion complete`, and exits — without ever writing `runs.status = 'completed'`. Hub does not currently touch the `runs` table at all (greppable in `apps/agent-hub/src` for `runs.status` returns zero hits). The web-side state-machine has a valid `executing → completed` transition (`apps/web/lib/state-machine.ts`) but nothing fires it. UI consequence: every Run History row shows the amber `executing` chip and `--` duration, even days after the conversation ended.

**Bug 3 — 18 orphan `pending` runs.**
Older runs that never got a user message (or were created via a code path that pre-dates the current `POST /api/runs` which now defaults `status: 'executing'`). New runs do NOT exhibit this bug because both `apps/web/app/api/runs/route.ts` (POST) and `apps/web/app/api/runs/[id]/messages/route.ts` (POST) explicitly set `status: 'executing'`. So this is data debt, not an active code bug. Cleanest fix is a one-shot SQL backfill that marks any `pending` run older than 1 day as `cancelled`, leaving new short-lived `pending` rows alone.

**False alarm — `0` Artifacts column on every Run History row.**
The Artifacts column reads the actual `artifacts` table count for each run, and that table is genuinely empty (`SELECT COUNT(*) FROM tenant_<id>.artifacts;` returns 0). Reason: agents in the round-table format do not produce artifacts — they only emit `agent_message` events. The "0" rendering is correct. **No fix needed for this UAT item.** Producing artifacts from round-table is a future feature, not a bug.

**What this phase does NOT do:**
- Add an artifact-production capability (round-table agents stay text-only).
- Re-introduce the formal `pending → planned → approved → executing` state-machine flow with plan-approval cards. That was deliberately bypassed in Phase 4 by the current `POST /api/runs` default of `status: 'executing'`. Reintroducing approval is a deliberate product decision, not a bug fix.
- Touch the LiteLLM-blocked items (UAT-13-02, UAT-13-03) — those reopen when Henrik fixes LiteLLM, separate from this phase.
- Backfill `runs.title` for old runs (deferred per Phase 13 deferred items).

</domain>

<decisions>
## Implementation Decisions

### Bug 1 — NaN:NaN timestamps

**Fix location:** `apps/web/app/api/runs/[id]/stream/route.ts` replay loop (line ~46-48).

**Action:** instead of `send(String(event.sequenceNumber), JSON.stringify(event))`, shape the envelope explicitly to match `HubEventEnvelope` (`packages/shared/src/hub-events.ts`) before sending:

```ts
const envelope = {
  type: event.type,
  agentId: event.agentId,
  runId: event.runId,
  tenantId,                                  // ← from outer scope, not in DB row
  sequenceNumber: event.sequenceNumber,
  content: event.content,
  metadata: event.metadata ?? undefined,
  timestamp: event.createdAt.toISOString(),  // ← THE FIX
};
send(String(event.sequenceNumber), JSON.stringify(envelope));
```

The Redis-published live path is unaffected — those messages are already shaped envelopes published by the hub's `MessageRouter.persistAndPublish`, so they pass through `JSON.parse(message)` and on without remap.

**Verification:** open any historical run in the console; every agent message shows a relative timestamp (e.g., `5d ago`, `13:42`) instead of `NaN:NaN`.

### Bug 2 — Stuck `executing` runs

**Fix location:** `apps/agent-hub/src/http/routes.ts` round-table handler. After the agent for-loop completes (currently line ~211 `log.info({...}, 'Round-table discussion complete')`), write the terminal state.

**Action:** the hub already imports `createTenantSchema` from `@beagle-console/db` for events. Reuse the same drizzle setup to update the runs table:

```ts
// At end of round-table handler, after the for-loop:
const { runs: runsTable } = createTenantSchema(tenantId);
await db.update(runsTable)
  .set({ status: 'completed', updatedAt: new Date() })
  .where(eq(runsTable.id, runId));

// Also publish a state_transition event so live UIs see the chip flip:
await router.persistAndPublish(tenantId, {
  type: 'state_transition',
  agentId: 'system',
  runId,
  tenantId,
  content: { from: 'executing', to: 'completed' },
  metadata: {},
});
```

**Failure mode:** if the DB write fails, log and continue — the run is "logically complete" even if status didn't update; the next run will still work. Don't throw, don't rollback the agent responses (they're already persisted).

**Idempotency:** if any agent threw mid-loop, the loop continues (`catch` at line 209) but the run still ends. The completed status is appropriate — we don't have a partial-failure state. If we want one later, that's a separate decision.

**Verification:**
1. Send a new run prompt against the deployed app.
2. Wait for all agents to respond.
3. Reload Run History — the row should show `completed` chip with a real duration.
4. The state_transition event should be visible in the run's events.

### Bug 3 — Backfill orphan `pending` runs

**One-shot SQL** to run from the migration container during deploy, OR ad-hoc on the VPS:

```sql
UPDATE tenant_eb61fa6a_1392_49c2_8209_ae8fa3612779.runs
SET status = 'cancelled', updated_at = NOW()
WHERE status = 'pending' AND created_at < NOW() - interval '1 day';
```

**Why `cancelled` not `completed`:** these runs never produced any agent output. `cancelled` is the state-machine terminal for "did not execute"; `completed` would be a lie. The Run History "Cancelled" filter then groups them sensibly out of the default view.

**Tenant scope:** Phase 13's migrate-13.ts had a tenant-discovery bug (read `shared.tenants` instead of `shared.organizations`). The same bug applies here — write the backfill to iterate `shared.organizations.id` instead, and document that the fix to migrate-13.ts is being folded into Phase 14 as a side effect (so the migration script gets the right table going forward, AND the backfill works for any future tenants).

**No code path change needed.** The current `POST /api/runs` and `POST /api/runs/[id]/messages` both already set `status: 'executing'`. The 18 orphans are pure data debt. We do NOT need a "guardrail" against future pending-orphans because no current code path leaves runs in pending.

**Verification:** after backfill, `SELECT status, COUNT(*) FROM runs GROUP BY status;` should show 0 stale `pending` rows. New runs created post-fix should still go to `executing` and then to `completed` once Bug 2's hub fix lands.

### Cross-cutting

- **Single deploy at end of phase**, same workflow as Phase 12/13.
- **Atomic commits per bug** — `fix(14-NN):` scope.
- **Tests:** unit tests for the SSE envelope-shaping helper (extract a tiny `dbRowToEnvelope` if it makes the route cleaner). Hub round-table completion is harder to unit test (sequential side-effecting loop); rely on UAT verification on a fresh run.
- **No new requirements added** beyond UAT-14-01..03 — these are bug fixes against existing requirements (TRAN-02, WORK-08).

### Claude's Discretion

- Whether to extract the SSE envelope shaping into a helper file or inline it.
- Whether to also handle the empty-state case where `event.metadata` is `null` vs. `undefined` (current code passes `event.metadata` which may be `null` from Postgres — clamp to `undefined` for the Zod schema's optionality).
- Whether to skip the `state_transition` event publication if the DB update fails (suggestion: skip — don't double-fail).
- Whether to apply the backfill SQL inside `migrate-13.ts` (already exists, idempotent), or write a new `migrate-14.ts`. Prefer extending `migrate-13.ts` for now since it already has the tenant-iteration pattern (and we're fixing the tenant-discovery bug there anyway).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files this phase will touch
- `apps/web/app/api/runs/[id]/stream/route.ts` — Bug 1 (envelope shaping)
- `apps/agent-hub/src/http/routes.ts` — Bug 2 (round-table completion)
- `packages/db/src/scripts/migrate-13.ts` — Bug 3 (tenant-discovery fix + add `pending → cancelled` backfill block)

### Files to read but not modify
- `packages/shared/src/hub-events.ts` — `HubEventEnvelope` Zod schema; the wire contract the SSE envelope must satisfy.
- `apps/agent-hub/src/events/event-store.ts` — reference for how the hub already shapes envelopes (line 29: `timestamp = new Date().toISOString()`).
- `apps/agent-hub/src/handlers/message-router.ts` — `persistAndPublish` is the existing helper for emitting state_transition events.
- `apps/web/lib/state-machine.ts` — `executing → completed` is a valid transition (Bug 2 is just an unfired transition, not an invalid one).
- `apps/web/components/transcript/agent-message.tsx` — `formatRelativeTime` uses `event.timestamp`; do NOT change this — fix the upstream serialization instead.

### Conventions
- Drizzle pattern for `createTenantSchema` is established in event-store.ts (Bug 2 reuses it).
- The hub does not currently have a `requireTenantContext`-style guard because it trusts its caller (the web app). Bug 2's DB write is therefore safe to add without auth changes.

</canonical_refs>

<specifics>
## Specific Ideas

- The DB row's `createdAt` is a JS Date when read via Drizzle, NOT a string. `event.createdAt.toISOString()` is the correct serialization.
- The `tenantId` is in the outer SSE handler scope but NOT in the DB row (it's implied by the schema). Including it in the envelope is required by the Zod schema (`tenantId: z.string().uuid()`).
- `metadata` from the DB is JSONB; Drizzle reads it as a parsed object. Pass it through, but coerce `null → undefined` to satisfy `metadata: z.record(...).optional()`.
- For Bug 2, the hub's `db` reference is on the request handler context — verify by reading `apps/agent-hub/src/http/routes.ts` imports before writing the update.
- The migrate-13.ts tenant-discovery fix (reading `shared.organizations` instead of `shared.tenants`) is in this phase's scope because (a) Phase 13's deploy worked around the bug manually and (b) Bug 3's backfill needs the same fix.

</specifics>

<deferred>
## Deferred Ideas

- Re-introducing plan-approval flow (`pending → planned → approved → executing`). Currently bypassed by design.
- Artifact production from round-table agents. Currently 0 by design.
- Backfilling `runs.title` for pre-Phase-13 runs (already deferred from Phase 13).
- Per-run state-machine guard in the hub (currently the hub doesn't validate transitions; it trusts the web app's calls).
- A dedicated `/runs/[id]/complete` endpoint instead of the hub doing the DB write directly (cleaner separation but more code; defer until needed).
- Webhook / outbound notification on run completion.
- Real-time UI flip of the chip from `executing → completed` without a page reload — requires SSE listening to the new state_transition events on the Run History page (today only the run page subscribes).

</deferred>

---

*Phase: 14-track-b-bugs-lifecycle-and-timestamps*
*Context gathered: 2026-04-27 from in-session investigation*
