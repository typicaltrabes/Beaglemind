---
phase: 19-free-flowing-conversation
plan: 02
subsystem: silence-driven-lifecycle
tags: [worker, bullmq, idle-timeout, lifecycle, watcher, message-router]
requirements: [UX-19-01, UX-19-04]
dependency_graph:
  requires:
    - "Plan 19-01 (runs.idle_timeout_minutes column + auto-complete-write removal)"
    - "BullMQ 5.75.2 already in apps/worker/package.json (placeholder, now active)"
    - "ioredis-backed Redis instance (already deployed for hub pub/sub)"
  provides:
    - "BullMQ `idle-timeout` queue served by apps/worker"
    - "MessageRouter.touchLastEventAtAndReschedule() side-effect on every publish"
    - "BullMQIdleTimeoutScheduler implementation of IdleTimeoutScheduler interface"
    - "Worker is the SOLE writer of `runs.status = 'completed'`"
    - "Worker is the SOLE emitter of `executing → completed` state_transition"
  affects:
    - "apps/web SSE consumers receive watcher-emitted state_transition on the existing run channel `run:${tenantId}:${runId}`"
    - "Plan 19-03 (presence_thinking_start/end) — every presence event now also reschedules the watcher (correctly: typing counts as activity)"
tech-stack:
  added:
    - "bullmq 5.75.2 (apps/agent-hub deps; was already in apps/worker)"
    - "drizzle-orm, ioredis, postgres, pino, @beagle-console/db, @beagle-console/shared, vitest, @types/node (apps/worker deps; matched to apps/agent-hub versions)"
  patterns:
    - "BullMQ delete-then-add idiom for reschedulable delayed jobs (`queue.remove(jobId).catch(() => 0)` then `queue.add(..., { jobId, delay })`)"
    - "Custom jobId = `${tenantId}:${runId}` for tenant-isolated, dedupe-safe enqueue"
    - "Optional dependency injection (4th constructor arg `idleScheduler?`) so tests can run without Redis"
    - "Best-effort post-publish bookkeeping: every side-effect wrapped in try/catch, failures log but never roll back the source-of-truth event row"
key-files:
  created:
    - "apps/worker/src/queues/idle-timeout.ts"
    - "apps/worker/src/__tests__/idle-timeout.test.ts"
    - "apps/agent-hub/src/handlers/idle-timeout-scheduler.ts"
  modified:
    - "apps/worker/package.json"
    - "apps/worker/src/index.ts"
    - "apps/agent-hub/package.json"
    - "apps/agent-hub/src/handlers/message-router.ts"
    - "apps/agent-hub/src/index.ts"
    - "apps/agent-hub/src/__tests__/message-router.test.ts"
decisions:
  - "Channel format `run:${tenantId}:${runId}` — verified against apps/agent-hub/src/bridge/redis-publisher.ts; this is the format the hub uses, NOT `run:${runId}` as the plan default suggested"
  - "Worker computes its own MAX(sequence_number)+1 for the state_transition event — the hub's SequenceCounter is in-memory and not shared with the worker; safe because the run is going terminal so no further events are expected"
  - "Default idle_timeout_minutes = 7 if missing in runs row OR if the read from Postgres fails (matches schema default and gives a graceful degradation path)"
  - "MessageRouter.idleScheduler is optional (4th constructor arg) — backward compatible with existing callsites and lets tests omit Redis"
metrics:
  duration: "≈25 min (single-pass execution, no rework)"
  tasks_completed: 3
  tests_added: 10  # 5 worker + 5 agent-hub (plan asked for 5+4=9; one extra)
  files_created: 3
  files_modified: 6
  completed: "2026-04-30T14:08:46Z"
---

# Phase 19 Plan 02: Idle-Timeout Watcher Summary

Wire the silence-driven lifecycle. Plan 19-01 removed `runRoundTable`'s auto-complete write; this plan adds the BullMQ-backed `idle-timeout` watcher that becomes the **sole writer** of `runs.status = 'completed'` and the **sole emitter** of the `executing → completed` state_transition event. Every event publish in `MessageRouter` now (a) touches `runs.last_event_at = NOW()` and (b) reschedules the watcher to fire `idle_timeout_minutes` from now — so a fresh prompt cycles 3 rounds → stays `executing` → goes silent for 7 minutes → flips to `completed` exactly once.

## What Shipped

- **BullMQ `idle-timeout` queue** served by `apps/worker`, with Redis-backed persistence so delayed jobs survive worker restarts
- **`createIdleTimeoutQueue` / `createIdleTimeoutWorker` / `processIdleTimeout`** exports in `apps/worker/src/queues/idle-timeout.ts`. The processor is pure (no BullMQ dep at the call site) so tests can drive it directly
- **`apps/worker/src/index.ts`** now boots the real worker (replacing the placeholder heartbeat). Includes `publishStateTransition` that persists the event row in the tenant's events table AND publishes the envelope on the run channel — both required because SSE replay needs the row, while live SSE needs the publish
- **`MessageRouter.touchLastEventAtAndReschedule()`** runs after every successful publish in BOTH `persistAndPublish` and `handleAgentMessage` paths
- **`BullMQIdleTimeoutScheduler`** in `apps/agent-hub/src/handlers/idle-timeout-scheduler.ts` — production implementation of the `IdleTimeoutScheduler` interface. Uses BullMQ's remove-then-add idiom (custom jobId `${tenantId}:${runId}` for dedup) since BullMQ doesn't support mutating delay
- **`apps/agent-hub/src/index.ts`** wires the scheduler into MessageRouter and adds `idleScheduler.close()` to graceful shutdown
- **10 vitest cases** total (5 worker + 5 agent-hub Phase 19-02 cases); plan asked for 9, delivered 10

## Channel Format — VERIFIED

The plan flagged this as **CRITICAL** with the warning that the watcher's `state_transition` would be invisible to the SSE pipeline if the channel diverges. I read `apps/agent-hub/src/bridge/redis-publisher.ts` line 19 and confirmed the format is:

```ts
const channel = `run:${event.tenantId}:${event.runId}`;
```

NOT `run:${runId}` as the plan's default suggestion mentioned. I used `run:${tenantId}:${runId}` in `apps/worker/src/index.ts` — the worker's `state_transition` lands on the same channel as agent events, so SSE consumers in `apps/web` receive both streams without code changes.

## Verification

```bash
$ cd apps/worker && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run
✓ Test Files  1 passed (1)
  Tests  5 passed (5)

$ cd apps/agent-hub && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run
✓ Test Files  8 passed (8)
  Tests  44 passed (44)  # 39 prior + 5 new Phase 19-02 cases
```

Both typecheck clean. All tests green.

## Test Coverage

**apps/worker `processIdleTimeout` (5 cases):**
1. Happy path: `executing → completed` + clears `currentRound` + publishes state_transition
2. Already-completed: no-op (no DB write, no publish)
3. Cancelled: no-op (no DB write, no publish)
4. Missing run row: no-op + warn (no DB write, no publish)
5. Publish failure: DB write still committed (publish is logged-not-thrown)

**apps/agent-hub `MessageRouter` Phase 19-02 cases (5):**
1. Reschedules on every `persistAndPublish` (2 calls → 2 schedules)
2. Per-run `idle_timeout_minutes` drives `scheduler.schedule(..., minutes)` (12 in test, default 7 fallback)
3. `last_event_at` updated on every publish (asserts `Date` instance in `.set()` payload)
4. No throw when scheduler is undefined (test/no-Redis path)
5. Scheduler errors do NOT roll back the publish (publisher.publish still called once, error logged)

## Lifecycle End-to-End

After this plan + Plan 19-01:

1. User submits prompt → `runRoundTable` runs N rounds (default 3) with each agent seeing the accumulating transcript. Run stays `executing` throughout
2. Each event publish in `MessageRouter` touches `last_event_at = NOW()` and reschedules the BullMQ delayed job to fire `idle_timeout_minutes × 60_000` ms from now (default 7 min)
3. As long as agents (or follow-up user messages) keep publishing events, the watcher never fires — each new event cancels the prior pending watcher and arms a fresh one
4. Once the run goes silent for `idle_timeout_minutes`, the BullMQ delayed job fires. Worker reads `runs.status`, confirms it's still `executing`, flips to `completed`, clears `current_round`, and publishes a `state_transition` (`from='executing'`, `to='completed'`, `triggeredBy='idle-timeout'`) on `run:${tenantId}:${runId}`
5. SSE consumer in `apps/web` receives the transition, run-status chip flips. Subsequent loads see the `state_transition` row in the events table because we persisted before publishing

## Threat Model — Mitigations Applied

All seven STRIDE threats from the plan's threat register are mitigated:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-19-02-01 (DoS / reschedule storm) | Each reschedule is one Redis `del`+`add`; bounded by event publish rate (already throttled by inter-round pause) |
| T-19-02-02 (double-fire race) | jobId-deduped at queue layer + processor's `if (status terminal) return` guard before UPDATE |
| T-19-02-03 (orphan job) | `processIdleTimeout` handles missing-row case with warn + skip |
| T-19-02-04 (DB outage during processor) | BullMQ default retries=3 + exponential backoff; failed jobs kept in `removeOnFail: 100` for debugging |
| T-19-02-05 (cross-tenant collision) | jobId = `${tenantId}:${runId}` — tenantId is a UUID, no collision |
| T-19-02-06 (channel mismatch) | **Verified at implementation time** — see Channel Format section above |
| T-19-02-07 (server restart loses jobs) | BullMQ default Redis-backed persistence; pending delayed jobs survive worker restart |

## Deviations from Plan

**None — plan executed exactly as written, with three minor enhancements:**

1. **Extra test case in agent-hub** — plan asked for 4 new MessageRouter tests; I added 5. The extra case (`passes the run-specific idle_timeout_minutes from the runs row`) explicitly verifies the read-from-DB → `scheduler.schedule(..., minutes)` pipeline; without it, a regression that hardcoded `7` would silently pass test 1
2. **`worker.on('error', ...)` listener** in `apps/worker/src/index.ts` (plan only mentioned `completed` and `failed`) — recommended in the BullMQ docs to avoid uncaught exceptions on connection-level errors
3. **`pubRedis.on('error', ...)` listener** in `apps/worker/src/index.ts` — same reason; ioredis emits `error` events on connection failures and an unhandled `error` event crashes the process

All three are Rule 2 (auto-add missing critical functionality) — none change behavior the plan specifies.

## Co-existence with Plan 19-03 (Parallel Wave 2)

I executed alongside Plan 19-03 (presence indicator). Two interactions worth recording:

1. **No file conflicts** — Plan 19-03 modifies `apps/agent-hub/src/http/routes.ts` (presence emission) and `apps/web/...` files. My changes are in `apps/worker/*`, `apps/agent-hub/src/handlers/message-router.ts`, `apps/agent-hub/src/handlers/idle-timeout-scheduler.ts`, and `apps/agent-hub/src/index.ts`. Disjoint
2. **Beneficial coupling** — Plan 19-03's `presence_thinking_start/end` events flow through `MessageRouter.persistAndPublish`, which means every presence event now ALSO reschedules the idle-timeout watcher. This is correct behavior: a typing indicator is activity that should keep the run alive

## Deferred Items / Follow-ups

- **`last_event_at` orphan-detection sweep** — if BullMQ retries exhaust on Postgres outage (T-19-02-04), the run stays `executing` indefinitely. UAT can identify these via `last_event_at < NOW() - (idle_timeout_minutes + 1) MINUTES AND status = 'executing'`. A periodic sweep job would auto-resolve. Out of scope for v1; track in deferred-items.md
- **Worker horizontal scaling** — current setup is single-worker. BullMQ supports multiple workers on the same queue with the jobId-dedup guarantee, but no acceptance criteria require it. Document if/when traffic justifies

## Self-Check: PASSED

- ✓ apps/worker/src/queues/idle-timeout.ts exists
- ✓ apps/worker/src/__tests__/idle-timeout.test.ts exists (5 cases passing)
- ✓ apps/worker/src/index.ts modified (real worker boot, channel verified)
- ✓ apps/worker/package.json updated (deps mirrored from agent-hub)
- ✓ apps/agent-hub/src/handlers/idle-timeout-scheduler.ts exists
- ✓ apps/agent-hub/src/handlers/message-router.ts modified (4th arg + touch + reschedule)
- ✓ apps/agent-hub/src/__tests__/message-router.test.ts has 12 cases (5 new)
- ✓ apps/agent-hub/src/index.ts wires scheduler + closes on shutdown
- ✓ apps/agent-hub/package.json adds bullmq 5.75.2
- ✓ Commit 245a0bc (Task 1) — feat(19-02-T1)
- ✓ Commit 3e6541b (Task 2) — feat(19-02-T2)
- ✓ Commit 522ecd5 (Task 3) — feat(19-02-T3)
- ✓ Both apps typecheck clean
- ✓ Both apps vitest green (worker 5/5, agent-hub 44/44)
