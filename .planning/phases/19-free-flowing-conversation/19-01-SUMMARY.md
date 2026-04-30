---
phase: 19-free-flowing-conversation
plan: 01
subsystem: hub-orchestrator
tags: [hub, schema, migration, multi-round, lifecycle, free-flowing-conversation]
requires:
  - packages/db/src/schema/tenant.ts (existing runs table)
  - apps/agent-hub/src/http/routes.ts:runRoundTable (existing single-pass orchestrator)
provides:
  - "5 new columns on tenant_<id>.runs (round_count, idle_timeout_minutes, inter_round_pause_ms, last_event_at, current_round)"
  - "migrate-19.ts (idempotent ADD COLUMN IF NOT EXISTS, per-tenant try/catch)"
  - "Multi-round runRoundTable: N=3 rounds (default), accumulating transcript across rounds, inter-round state_transition + sleep, auto-complete write removed"
  - "loadRunConfig helper (per-run snapshot semantics, defaults fallback)"
affects:
  - "Plan 19-02 idle-timeout watcher (becomes sole writer of status='completed'; reads last_event_at + idle_timeout_minutes)"
  - "Plan 19-03 presence indicators (will wrap sendToAgent with thinking_start/thinking_end events)"
  - "Plan 19-04 Continue button (will re-enter runRoundTable with userPrompt='')"
  - "UI: run history list and run detail header (currently keys off status='executing'; runs now stay executing indefinitely until idle timer fires)"
tech-stack:
  added: []
  patterns:
    - "Per-run configuration snapshot via DB columns (not project-scoped, so changing project defaults doesn't retroactively affect in-flight runs)"
    - "vi.hoisted for spy variables referenced in vi.mock factories"
key-files:
  created:
    - packages/db/src/scripts/migrate-19.ts
    - apps/agent-hub/src/__tests__/routes-multi-round.test.ts
  modified:
    - packages/db/src/schema/tenant.ts
    - apps/agent-hub/src/http/routes.ts
    - apps/agent-hub/src/__tests__/routes.test.ts
    - apps/agent-hub/src/__tests__/routes-history.test.ts
decisions:
  - "Per-run snapshot of config (5 columns on runs) chosen over project-scoped table — avoids retroactive defaults change bug per CONTEXT.md Claude's Discretion."
  - "loadRunConfig defaults fallback (3/7/1500) — covers the gap between migration apply and the next runs.update that populates them, so legacy runs don't crash."
  - "Vision pass-through fires on round 1 ONLY — single-image-per-prompt semantics from Phase 17 (rounds 2+ inherit context as text via the GROUP DISCUSSION block)."
  - "All-failed round still counts toward N + emits the inter-round transition (no early-stop, per CONTEXT.md)."
  - "metadata.round added to every agent_message + failure-marker event for UI/timeline grouping."
  - "vi.hoisted used in routes-multi-round.test.ts because vi.mock factories see top-level consts as undefined (factory is hoisted above the const declarations)."
metrics:
  duration: 35min
  completed: 2026-04-30
  tasks_completed: 3
  commits: 2
  tests_added: 8
  tests_total: 36
---

# Phase 19 Plan 01: Free-flowing Conversation Substrate Summary

**One-liner:** Multi-round runRoundTable (N=3 default) with accumulating transcript, inter-round state_transitions, and auto-complete write removed — runs now stay `executing` until Plan 19-02's idle-timeout watcher fires.

## Schema Diff

`packages/db/src/schema/tenant.ts` — `runs` table:

```diff
   const runs = schema.table('runs', {
     ...
     title: varchar('title', { length: 80 }),
+    // Phase 19: per-run configuration snapshot. Read at round-start; changing
+    // project defaults later does NOT retroactively change in-flight runs.
+    roundCount: integer('round_count').notNull().default(3),
+    idleTimeoutMinutes: integer('idle_timeout_minutes').notNull().default(7),
+    interRoundPauseMs: integer('inter_round_pause_ms').notNull().default(1500),
+    // Phase 19: silence-driven lifecycle bookkeeping. last_event_at is touched
+    // on every event publish (see Plan 19-02 watcher); current_round is bumped
+    // by runRoundTable's outer loop and useful for UI debugging.
+    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
+    currentRound: integer('current_round'),
     createdBy: text('created_by').notNull(),
     ...
   });
```

## Migration Script

`packages/db/src/scripts/migrate-19.ts` — mirrors `migrate-17-1.ts` exactly:

- Connects via `DATABASE_URL` or local default
- Iterates `shared.organizations` (per Phase 14 fix)
- Per-tenant try/catch — one bad tenant doesn't block the rest
- Single `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... , ... , ... , ... , ...` statement (5 columns, idempotent)
- Logs one line per tenant + final tenant count
- Re-running is a no-op

Run with: `corepack pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-19.ts`

## Multi-round Loop Diff

`apps/agent-hub/src/http/routes.ts` (351 lines reworked, +231/-120):

### Added

- **`loadRunConfig(tenantId, runId)`** — top-of-file helper. Reads `roundCount`, `idleTimeoutMinutes`, `interRoundPauseMs` from the tenant's `runs` row via `db.select(...).from(runs).where(eq(runs.id, runId)).limit(1)`. Wrapped in try/catch with defaults fallback (3/7/1500) for legacy rows or DB blips.
- **`sleep(ms)`** — Promise-based timer for inter-round pause.
- **Outer loop:** `for (let round = 1; round <= roundCount; round++) { ... }` wrapping the existing per-agent loop.
- **Per-round bookkeeping:** `db.update(runs).set({ currentRound: round, updatedAt: new Date() }).where(eq(runs.id, runId))` at the start of each round (best-effort; failures logged but don't abort).
- **`metadata.round`** on every `agent_message` event (real replies + failure markers) so UI/timeline can group by round.
- **Inter-round transition:** `if (round < roundCount) { router.persistAndPublish({ type: 'state_transition', content: { from: 'round-${round}', to: 'round-${round + 1}' } }); await sleep(interRoundPauseMs); }`
- **`allFailedThisRound` warn log** when all 3 agents fail in a round (no early-stop; round still counts toward N).

### Preserved

- Plan 17.1-07's PRIOR CONVERSATION block (loaded once before the rounds loop, since prior history doesn't change between rounds)
- Failure-bubble logic (failure markers preserved with `errorKind: 'agent_failure'` metadata)
- Vision pass-through (now gated by `round === 1` — see Removed/Changed below)
- `transcript[]` accumulator (now spans rounds, not just intra-round)

### Removed (the explicit drop required by Plan 19-01)

```diff
-  // UAT-14-02: mark the run completed in the DB so Run History stops showing
-  // the amber `executing` chip indefinitely. Best-effort — if the write fails
-  // the agent responses are already persisted, so the run is logically done.
-  try {
-    const { runs: runsTable } = createTenantSchema(tenantId);
-    await db
-      .update(runsTable)
-      .set({ status: 'completed', updatedAt: new Date() })
-      .where(eq(runsTable.id, runId));
-  } catch (err: any) {
-    log.error(...);
-  }
-
-  // UAT-14-02: emit state_transition so live UIs flip the chip without a reload.
-  try {
-    await router.persistAndPublish(tenantId, {
-      type: 'state_transition',
-      agentId: 'system',
-      runId,
-      tenantId,
-      content: { from: 'executing', to: 'completed' },
-      metadata: {},
-    });
-  } catch (err: any) {
-    log.error(...);
-  }
```

Both the `db.update({ status: 'completed' })` and the `state_transition: executing → completed` emission are gone. Plan 19-02's idle-timeout watcher will be the sole writer of `completed`.

### Changed

- Vision dispatch gate: `round === 1 && imageAttachments && imageAttachments.length > 0 && VISION_CAPABLE.has(agentId)` — was just the latter three. Rounds 2+ skip the vision bridge and use `sendToAgent` text-only because the round-1 vision turn already produced a text reply now in the `--- GROUP DISCUSSION ---` block.

## Test Cases Added

`apps/agent-hub/src/__tests__/routes-multi-round.test.ts` (8 cases):

1. **N=3 invokes sendToAgent exactly 9x with mo→jarvis→herman per round** — also asserts `agent_message` event order + `metadata.round` per event.
2. **Round 2's first agent (mo) sees round-1 transcript** — captures `mockedSendToAgent.mock.calls[3][1]` and asserts it contains "Mo: mo-r1-text", "Jarvis: jarvis-r1-text", "Herman: herman-r1-text" inside the GROUP DISCUSSION block.
3. **Inter-round state_transitions fire (round-1→round-2, round-2→round-3) but NOT after the last round** — asserts exactly 2 transition events with the right content.
4. **No `state_transition` with `content.to === 'completed'` is emitted at end** — Plan 19-02 owns completion.
5. **No `db.update({ status: 'completed' })` is performed at end** — inspects every `.set()` call's argument.
6. **Round 1 forwards imageAttachments to vision bridge; rounds 2+ use sendToAgent text-only** — vision called 2x (mo + jarvis on round 1); text bridge called 7x (1 herman in round 1 + 6 across rounds 2-3).
7. **All-failed round 1 still continues to round 2 + still counts toward N** — sendToAgent returns null on round 1; rounds 2+3 succeed; 3 failure markers emitted; 2 inter-round transitions still fire.
8. **`round_count = 1` runs single pass and emits NO inter-round state_transition** — minimal-config edge case.

`apps/agent-hub/src/__tests__/routes.test.ts` and `routes-history.test.ts`: added `db.select` chain mocks returning `roundCount: 1` so legacy single-pass assertions still hold without rewriting them.

## Grep-Gate Verification

```
$ grep -v '^[[:space:]]*//\|^[[:space:]]*\*' apps/agent-hub/src/http/routes.ts \
    | grep -cE "status:\s*['\"]completed['\"]"
0    # auto-complete write provably gone from non-comment lines

$ grep -v '^[[:space:]]*//\|^[[:space:]]*\*' apps/agent-hub/src/http/routes.ts \
    | grep -cE "for\s*\(\s*let\s+round"
1    # multi-round outer loop in place

$ grep -c "round-\${round + 1}\|round-\\\${round" apps/agent-hub/src/http/routes.ts
1    # inter-round state_transition emission present
```

All three gates pass.

## Test Counts

```
Test Files  7 passed (7)
Tests       36 passed (36)
```

- 28 pre-existing tests (unchanged behavior)
- 8 new multi-round tests (this plan)
- 0 failed, 0 skipped

## Diff Size

```
 apps/agent-hub/src/http/routes.ts     | 351 ++++++++++++++++++++++------------
 packages/db/src/schema/tenant.ts      |  10 +
 packages/db/src/scripts/migrate-19.ts |  68 +++++++
 3 files changed, 309 insertions(+), 120 deletions(-)
```

Plus tests:
- `apps/agent-hub/src/__tests__/routes-multi-round.test.ts` — 369 lines new
- `apps/agent-hub/src/__tests__/routes.test.ts` — 11 lines added (db.select mock)
- `apps/agent-hub/src/__tests__/routes-history.test.ts` — 17 lines added (db.select mock)

## Deviations from Plan

None — plan executed as written. One small adjustment worth noting:

**[Adjustment - Test mock pattern]** The plan's Task 2 instruction said "extend the `db.select` mock to return `{ roundCount: 1, ... }`" for the existing tests. I implemented this via the standard chained mock pattern (`select().from().where().limit()`) matching the way `loadRunConfig` walks the chain. The new multi-round test file uses `vi.hoisted` to make the spies referenced inside `vi.mock` factories observable from `it()` bodies — a Vitest hoisting requirement; without it, `updateSpy` was undefined inside the factory.

## Verification

- `corepack pnpm --filter @beagle-console/db exec tsc --noEmit` → exit 0
- `cd apps/agent-hub && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run` → exit 0
- All 3 grep gates pass (see above)
- Migration is idempotent (ADD COLUMN IF NOT EXISTS across all tenants; per-tenant try/catch)

## Self-Check: PASSED

- Schema additions exist in `packages/db/src/schema/tenant.ts` (5 new columns)
- `packages/db/src/scripts/migrate-19.ts` exists and compiles
- `apps/agent-hub/src/__tests__/routes-multi-round.test.ts` exists (8 new test cases)
- Both commits exist in git log:
  - `109fc5e feat(19-01-T1): drizzle schema additions + migrate-19.ts`
  - `838b18f feat(19-01-T2): multi-round runRoundTable + delete auto-complete write`
- All 36 vitest cases pass
- All 3 grep gates return expected counts (0, 1, 1)

## Threat Flags

None. The changes operate within the existing trust boundaries documented in the plan's `<threat_model>` (hub→tenant Postgres, hub→MessageRouter). No new network endpoints, auth paths, or cross-tenant access patterns introduced.

## Next Plan

`19-02-PLAN.md` — idle-timeout watcher: BullMQ delayed job keyed by `${tenantId}:${runId}` that reads `last_event_at` + `idle_timeout_minutes` and writes `status: 'completed'` + emits `state_transition: executing → completed` when silence exceeds the timeout.
