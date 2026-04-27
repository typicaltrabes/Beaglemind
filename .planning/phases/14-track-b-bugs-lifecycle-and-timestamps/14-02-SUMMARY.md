---
phase: 14-track-b-bugs-lifecycle-and-timestamps
plan: 02
subsystem: agent-hub
tags: [bugfix, lifecycle, runs-status, state-transition, tenant-db]
requires:
  - "@beagle-console/db: db, createTenantSchema (already a runtime dep of agent-hub)"
  - "drizzle-orm: eq (already a runtime dep of agent-hub)"
provides:
  - "runRoundTable terminal completion: writes runs.status='completed' and emits state_transition after agent for-loop"
affects:
  - apps/agent-hub/src/http/routes.ts
tech-stack:
  added: []
  patterns:
    - "Best-effort independent try/catch for DB write + event publish (failures isolated, agent responses never rolled back)"
    - "Reuse of createTenantSchema(tenantId) factory (same pattern as event-store.ts:27)"
key-files:
  created: []
  modified:
    - apps/agent-hub/src/http/routes.ts
decisions:
  - "Two independent try/catches (DB write + Redis publish), not nested — DB row is source of truth, failed publish must not roll back status"
  - "Destructure as `runsTable` (not `runs`) to remove future shadowing risk and make grep targeted"
  - "agentId: 'system' on the state_transition (matches handleRunStop / handleRunApprove convention)"
  - "metadata: {} (matches EventStore.persist's `event.metadata ?? {}` wire convention)"
  - "No state-machine validation here — hub records terminal status; web-side state machine validates user-driven transitions"
  - "No new columns on runs (no completedAt, no endedAt) — only status + updatedAt"
metrics:
  duration: "~25min"
  completed: "2026-04-27"
  tasks: 1
  files: 1
---

# Phase 14 Plan 02: Hub round-table marks runs `completed` Summary

**One-liner:** runRoundTable now writes `tenant_<id>.runs.status = 'completed'` and emits a `state_transition` event after the agent for-loop, with both writes wrapped in independent best-effort try/catch.

## What Changed

`apps/agent-hub/src/http/routes.ts` (+37 lines, additive only):

1. **Imports added (lines 8-9):**
   - `import { db, createTenantSchema } from '@beagle-console/db'`
   - `import { eq } from 'drizzle-orm'`

   No `package.json` change — both packages were already runtime deps (verified in `apps/agent-hub/package.json` lines 11, 13).

2. **`runRoundTable` terminal completion block (inserted between for-loop close and existing `log.info` at line 249):**
   - `try` block 1: `db.update(runsTable).set({ status: 'completed', updatedAt: new Date() }).where(eq(runsTable.id, runId))` — best-effort DB write, errors logged and swallowed.
   - `try` block 2: `router.persistAndPublish(tenantId, { type: 'state_transition', agentId: 'system', runId, tenantId, content: { from: 'executing', to: 'completed' }, metadata: {} })` — best-effort event publish, errors logged and swallowed.
   - Existing `log.info({ ... }, 'Round-table discussion complete')` left untouched (load-bearing breadcrumb in production logs).

## Why It Matters (Bug 2 from CONTEXT.md)

Before this plan: every run was stuck on `executing` chip indefinitely. The hub's round-table function iterated all three agents (mo, jarvis, herman), persisted each agent_message, then exited via the `log.info` breadcrumb — without ever updating `runs.status`. The web app's Run History page therefore kept showing the amber `executing` chip even on runs whose agent traffic completed days ago.

After this plan: when the for-loop exits (normal or all-agents-threw), the hub flips `status` to `completed` and broadcasts a `state_transition` event. Live UIs flip the chip via SSE; reload-only viewers see the right status from the DB.

## Verification

**Static (passed):**
- `grep "import { db, createTenantSchema } from '@beagle-console/db'"` — found at line 8
- `grep "import { eq } from 'drizzle-orm'"` — found at line 9
- `grep "const { runs: runsTable } = createTenantSchema(tenantId)"` — found at line 218
- `grep ".set({ status: 'completed', updatedAt: new Date() })"` — found at line 221
- `grep ".where(eq(runsTable.id, runId))"` — found at line 222
- `grep "content: { from: 'executing', to: 'completed' }"` — found at line 239
- `grep "Round-table discussion complete"` — present at line 249, unchanged
- `grep "Failed to mark run completed (continuing)"` and `grep "Failed to publish completed state_transition (continuing)"` — both present once each (count=2)

**Type-check (no new errors introduced):**
- `pnpm --filter @beagle-console/agent-hub exec tsc --noEmit` — same 3 pre-existing errors as HEAD baseline (proven by `git stash` + re-run), all in code outside this plan's scope. Zero new type errors from the additions. See `Deferred Issues` below.

**Tests (no regression):**
- `pnpm --filter @beagle-console/agent-hub exec vitest run` — same pre-existing config-loading failure as HEAD baseline (proven by `git stash` + re-run). 9/9 tests in loadable suites still pass. No regression.

**Manual verification (deferred to deploy plan 14-04):** start a new run on console.beaglemind.ai, wait for all three agents to respond, reload Run History — the row shows `completed` chip; the run page transcript ends with a `state_transition` event with `from: executing, to: completed`.

## Deviations from Plan

None — plan executed exactly as written. The two acceptance-criteria commands (`tsc` and `vitest`) returned non-zero exit codes due to pre-existing baseline failures, but executor scope-boundary rules require ignoring failures in unrelated code. Failures were proven pre-existing via `git stash` + re-run.

## Deferred Issues

Logged to `.planning/phases/14-track-b-bugs-lifecycle-and-timestamps/deferred-items.md`:

1. **Pre-existing TS errors in agent-hub** — `openclaw-cli-bridge.ts:73` and `routes.ts:201` (the `costUsd`/`model` keys in metadata) need an explicit return type on `sendToAgent`. Inside the per-agent loop body which the plan explicitly forbids modifying. Out of 14-02 scope.
2. **Pre-existing vitest config-loading failure** — `config.ts` does top-level `EnvSchema.parse(process.env)` requiring `DATABASE_URL`/`REDIS_URL`, breaks any test that transitively imports `logger.ts`. Needs lazy config loading or test fixtures. Out of 14-02 scope.

## Key Decisions Made

1. **Two independent try/catches.** A failed Redis publish must not roll back the DB status. The DB row is the source of truth; the event is a UX optimization for live SSE viewers.
2. **No state-machine validation in the hub.** Per `<context>` and CONTEXT.md `<deferred items>`: the hub does not currently validate transitions. It trusts the web app. Adding a precondition check would be scope creep.
3. **No new columns on `runs`.** No `completedAt`, no `endedAt`. The plan touches only `status` + `updatedAt`. CONTEXT.md `<decisions>` Bug 2: "if we want a partial-failure status later, that's a separate decision."
4. **Destructure as `runsTable`** (not `runs`) — explicit anti-shadowing per the plan's `<action>` notes.
5. **`metadata: {}` not `undefined`** — matches `EventStore.persist`'s `event.metadata ?? {}` wire convention so downstream consumers see `{}` consistently.

## Commits

- `4455a99` — `fix(14-02): mark round-table runs completed in DB and emit state_transition`

## Self-Check

- File `apps/agent-hub/src/http/routes.ts`: FOUND (modified, 250 lines)
- File `.planning/phases/14-track-b-bugs-lifecycle-and-timestamps/deferred-items.md`: FOUND
- Commit `4455a99`: FOUND in `git log --oneline`

## Self-Check: PASSED
