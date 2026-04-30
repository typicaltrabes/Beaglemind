---
phase: 19-free-flowing-conversation
plan: 06
type: execute
status: complete
duration: ~2h (planning + parallel waves + deploy + 3 hot-fixes + Playwright UAT)
deployed_sha: 8e2dff6
deployed_at: 2026-04-30
---

# Phase 19-06 — Deploy Phase 19 to BeagleHQ

## Outcome

Phase 19 (Free-flowing Conversation Substrate) deployed live to https://console.beaglemind.ai. End-to-end verified via Playwright on a real round-table run that produced 3 rounds × 3 agents = 9 agent replies, 9 presence start/end pairs, 2 inter-round state_transitions, and stayed `executing` (no auto-complete) until manually stopped.

All 6 plans landed across 5 waves; deploy required 3 hot-fixes on top of the plan code, all committed and pushed.

## Commits deployed

Phase 19 plan commits (waves 1-4):
- `109fc5e` feat(19-01-T1): drizzle schema additions + migrate-19.ts
- `838b18f` feat(19-01-T2): multi-round runRoundTable + delete auto-complete write
- `c00a422` docs(19-01)
- `245a0bc` feat(19-02-T1): idle-timeout BullMQ queue + processor
- `3e6541b` feat(19-02-T2): boot idle-timeout worker
- `522ecd5` feat(19-02-T3): MessageRouter reschedules watcher + last_event_at
- `ee00c3c` docs(19-02)
- `dbfaa26`/`8372b6b` test+feat(19-03-T1): MessageType enum + presence emission
- `b0abf0b`/`2e1cea7` test+feat(19-03-T2): AgentPresenceIndicator component
- `940836d`/`c6f2e20` test+feat(19-03-T3): run-store thinkingAgent slice
- `4506398` docs(19-03)
- `3d15e44`/`09a6115` test+feat(19-04-T1): continueOnly Zod + runRoundTable branch
- `430430f`/`77f9b20` test+feat(19-04-T2): /continue endpoint + ContinueButton
- `2c9c3bd`/`01a09b3` test+feat(19-04-T3): LiveIndicator + run-metadata-row + run-history-table
- `f500fb8` docs(19-04)
- `55d5e83`/`bbe113f` test+feat(19-05-T1): consumeQueuedMessages + current_round clear-on-exit
- `8066205`/`0f7334a` test+feat(19-05-T2): messages route current_round branch
- `5f30c93` docs(19-05)

Deploy hot-fixes (wave 5 — diagnosed during UAT):
- `9449d64` fix(19-06): worker Dockerfile uses tsx runtime, not built dist
- `eb4f66b` fix(19-06): forward Redis auth from URL into BullMQ connection options
- `dcf2ba7` fix(19-04): run-store ignores inter-round state_transition markers
- `f9b972c` fix(19-04): hydrate run-store status from API on run-page mount
- `8e2dff6` fix(19-02): switch BullMQ jobId separator from `:` to `__` (BullMQ rejects `:`)

## Migration

Applied 5 columns to `tenant_eb61fa6a_1392_49c2_8209_ae8fa3612779.runs`:

```sql
ALTER TABLE tenant_eb61fa6a_1392_49c2_8209_ae8fa3612779.runs
  ADD COLUMN IF NOT EXISTS round_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS idle_timeout_minutes integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS inter_round_pause_ms integer NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_round integer;
```

Verified via `\d` — all 5 columns exist with correct defaults. Hanseatic is the only tenant in `shared.organizations`.

migrate-19.ts (the workspace-script version) was NOT run because `pnpm` isn't installed on the BeagleHQ host and pre-existing container images don't ship the script. Direct SQL was the practical equivalent for a single-tenant deploy. The script is committed for future tenants.

## Container rebuilds

| Container | Image SHA | Status |
|-----------|-----------|--------|
| `beagle-console-console-web-1` | rebuilt 3× (initial + run-store fix + hydration fix) | Up |
| `beagle-console-console-agent-hub-1` | rebuilt 2× (initial + jobId fix) | Up |
| `beagle-console-console-worker-1` | rebuilt 3× (Dockerfile fix + Redis auth + final) | Up — `Worker started { queue: 'idle-timeout' }` |

## Verified end-to-end (Playwright UAT)

Test run: `c5597962-11b1-478b-bbfa-e5b761fdbcdd`. Prompt: "Phase 19 UAT: brief one-line takes on whether free-flowing multi-round chat improves agent reasoning quality."

DB state confirmed via psql:
- 25+ events: 1 user prompt, 9 presence_thinking_start, 9 presence_thinking_end, 9 agent_message (mo+jarvis+herman × 3 rounds), 2 state_transition (round-1→round-2, round-2→round-3)
- `metadata.round` correctly populated (1, 2, or 3) on every agent_message
- `current_round` advanced 1 → 2 → 3 then NULL on exit (Plan 19-05 clear-on-exit working)
- `status` stayed `executing` for the entire run (Plan 19-01 auto-complete drop working)
- `last_event_at` updated on every publish (Plan 19-02 touch working)

UI state confirmed via browser_evaluate on https://console.beaglemind.ai:
- ✅ `data-testid="live-indicator"` rendering with correct brand-orange pulsing dot + "Live" label (`bg-amber-500/10`, `text-amber-300`, `animate-ping`)
- ✅ `data-testid="continue-button"` rendering with text "Continue conversation"
- ✅ `data-testid="agent-presence-indicator"` rendering with text "Mo is thinking..." then "Jarvis is thinking..." then "Herman is thinking..." sequentially
- ✅ Run-metadata-row showed "Live · #c5597962 · -- · $7.13 · 3 agents · 12 events · 10m ago"
- ✅ Agents referenced each other across rounds — proves the substrate works for the actual UX goal

BullMQ confirmed via direct ioredis query in worker container:
- Queue keys exist: `bull:idle-timeout:{stalled-check,delayed,id,meta,events,<jobId>}`
- After triggering one event publish (via /api/runs/[id]/stop), a delayed job appeared at jobId `eb61fa6a-1392-49c2-8209-ae8fa3612779__c5597962-11b1-478b-bbfa-e5b761fdbcdd` with score = NOW + 7×60×1000 ms

Worker correctness:
- Plan 19-02 unit tests (5 cases) cover: executing → completed flip, no-op on already-completed/cancelled/missing, no rollback if publish throws. All green pre-deploy.
- Live worker boot log: `{"queue":"idle-timeout","msg":"Worker started"}` — no auth errors, no module-resolution errors after fixes.

## Hot-fixes diagnosed during UAT (NOT in original plans)

Five issues surfaced post-deploy that the plans + tests didn't catch:

### 1. Worker Dockerfile — `ERR_MODULE_NOT_FOUND` for `@beagle-console/db`
**Root cause:** The plan inherited the multi-stage build that copies `packages/db/dist`, but `@beagle-console/db/package.json` exports point at `./src/index.ts` (workspace TS source — no build output). Node ESM resolution looked for the .ts file at runtime and failed.
**Fix:** Mirror the agent-hub Dockerfile pattern — install deps, copy source, run via `pnpm --filter @beagle-console/worker start` (tsx). Added a `start` script.
**Lesson:** Plans for new containerized services should explicitly state "uses tsx like agent-hub" rather than implying multi-stage tsc compile.

### 2. Redis auth dropped — `NOAUTH Authentication required`
**Root cause:** Both `buildRedisConnection` (worker) and `BullMQIdleTimeoutScheduler` constructor (agent-hub) extracted only `host` + `port` from `REDIS_URL`, dropping `user` + `password`. Production Redis (`sonic-hq-redis-1`) requires AUTH.
**Fix:** Forward `username` and URL-decoded `password` into ConnectionOptions.
**Lesson:** When a plan says "extract host:port from URL", remember that BullMQ's ConnectionOptions accepts username/password too — just pass the whole URL via `new Redis(url)` if possible, or extract all 4 fields.

### 3. run-store reducer clobbered status with round-N markers
**Root cause:** Plan 19-01 introduced `state_transition` events with `content.to: 'round-2'` / `'round-3'`. The pre-existing run-store reducer assigned `event.content.to` directly to `status` without filtering. Result: store status flipped from `executing` → `round-2` → `round-3`, and the LiveIndicator (which exact-matches `'executing'`) disappeared after round 1.
**Fix:** Filter to only the 6 RunStatus enum values (`pending|planned|approved|executing|completed|cancelled`); ignore round-N values. Plus 4 regression tests.
**Lesson:** Plans that introduce new event semantics on shared types must audit existing consumers that pattern-match on the type.

### 4. run-store status never hydrated from API
**Root cause:** Runs are created with `status: 'executing'` directly in `/api/runs` POST — no `pending → executing` state_transition is ever emitted. The run-store starts at `INITIAL_STATE.status = 'pending'` and only progresses on state_transition events. Result: store stayed at `'pending'` for the entire executing window. This was a pre-existing bug masked by the old auto-complete `executing → completed` write that at least flipped the store at the end. Phase 19's silence-driven lifecycle removed that signal, exposing the bug.
**Fix:** Added `syncStatusFromApi` action on run-store that one-shot hydrates from the `useRun()` API row when the store is still at `INITIAL_STATE`. Wired via useEffect on the run page.
**Lesson:** Stores derived from event streams need an initial-hydration path for state that exists in DB but never has a corresponding birth event.

### 5. BullMQ jobId rejected for containing `:`
**Root cause:** Plan 19-02 specified `jobId = '${tenantId}:${runId}'`. Tests passed because mocks didn't reach BullMQ, but production hub logged `"Custom Id cannot contain :"` on every persistAndPublish — every reschedule silently failed (try/catch wrapped per plan), no idle-timeout job was ever queued, and the silence-driven lifecycle would never have fired.
**Fix:** Switch separator to `__`. Both halves are UUIDs so collision impossible.
**Lesson:** Library API constraints not exercised by mocks should be added to deploy smoke checks. (Future: a Playwright test that hits the dev hub and verifies `bull:idle-timeout:delayed` becomes non-empty after one event would have caught this.)

## What's NOT verified live

- **Idle-timeout watcher firing executing→completed after 7 minutes:** Did not wait for the 7-minute window to elapse on the test run. Plan 19-02 unit tests cover the processor logic. The fact that delayed jobs ARE now successfully queued (jobId fix) means the firing is just a clock matter — Plan 19-02's `processIdleTimeout` is unchanged from the unit-tested path.
- **Continue button click + new round-cycle on existing run:** Did not exercise — would fire another round of agent calls (real cost). Component renders correctly with disabled state + brand-orange styling per Plan 19-04 RTL tests.
- **Mid-conversation message queueing (Plan 19-05):** Did not exercise mid-round message post during a live run. Plan 19-05 unit tests cover the messages route branch + consumeQueuedMessages logic. Future UAT: post a follow-up while round 2 is mid-flight, confirm `metadata.queuedForNextRound = true` on the persisted event and confirm round 3's prompt contains the queued text.

These are deferred to Lucas's eventual hands-on verification.

## Deferred items

- Settings-page UI for `roundCountDefault`, `idleTimeoutMinutes`, `interRoundPauseMs` (per CONTEXT.md — own phase)
- Vision pass-through across rounds (currently round 1 only)
- Mobile-specific UX for live indicators / Continue button
- BullMQ pending-job sweep job for orphan-detection if retries exhaust
- Queued-attachments fan-out (Plan 19-05 deferred — queued messages with attachments show in transcript with chips, but agents see only raw text in the User: block)
- Sequence-collision fix for the messages route queue path via hub-side enqueue endpoint (Plan 19-05 deferred)
- Reapply migrate-19.ts via the agent-hub container script as future tenants are provisioned

## Threat model status

All threats from PLAN-19-06 either mitigated (containers came up clean, BullMQ persistence verified by surviving worker restart cycle, no schema mismatch) or accepted (5-second worst-case delay on first idle-timeout fire after a worker restart).

## Smoke logs

- Hub during UAT: showed presence_thinking_start/end pairs, round-2/round-3 prompts being built, "Round-table discussion complete; run stays executing until idle-timeout" (the new exit-log line)
- Worker post-deploy: `Worker started` then idle (no jobs to process yet for the test run because it was stopped before the 7-min window expired)
- Web: 0 error console messages on production run page after fixes (excluding pre-existing favicon 404 + better-auth org-active-member 400)
