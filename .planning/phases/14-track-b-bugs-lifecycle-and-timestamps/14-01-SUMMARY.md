---
phase: 14-track-b-bugs-lifecycle-and-timestamps
plan: 01
subsystem: api
tags: [sse, zod, drizzle, hub-events, replay]

# Dependency graph
requires:
  - phase: 04-hub-foundation
    provides: HubEventEnvelope wire contract (packages/shared/src/hub-events.ts)
  - phase: 05-events-table
    provides: Tenant-scoped events table + Drizzle schema (packages/db/src/schema/tenant.ts)
provides:
  - Pure helper dbRowToEnvelope mapping a Drizzle events row to a HubEventEnvelope
  - SSE replay path that emits ISO-8601 timestamps instead of raw rows missing the timestamp field
  - Unit-test coverage proving Zod-schema compliance for replayed envelopes
affects: [14-04 deploy plan, future SSE consumers, transcript rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-helper boundary between Drizzle row type and Zod wire contract — keep mapping unit-testable, no inline logic in route handlers"
    - "Coerce JSONB null → omitted property when Zod schema uses .optional() (which rejects explicit null)"

key-files:
  created:
    - apps/web/lib/sse-envelope.ts
    - apps/web/lib/sse-envelope.test.ts
  modified:
    - apps/web/app/api/runs/[id]/stream/route.ts

key-decisions:
  - "Extract a pure dbRowToEnvelope helper rather than inline the mapping in the SSE route — single source of truth, unit-testable, mirrors event-store.ts:29 canonical timestamp serialization"
  - "Cast JSONB content/metadata at the helper boundary rather than narrowing Drizzle's inferred unknown type at the route — keeps the route handler clean and centralizes the trust boundary"
  - "Drop metadata key entirely when DB returns null (rather than coerce to empty object) — empty object is a different signal than 'no metadata' and would silently rewrite stored data"

patterns-established:
  - "DB-row-to-envelope mapping pattern: a pure exported function with strict input interface (EventDbRow) and Zod-compliant output, unit-tested against the actual Zod schema via .parse()"
  - "Test fixtures must use valid UUID v4 (variant nibble 8/9/a/b) — Zod v4's UUID format is strict; all-1s/all-2s style UUIDs fail validation"

requirements-completed: [UAT-14-01]

# Metrics
duration: ~6min
completed: 2026-04-27
---

# Phase 14 Plan 01: Fix NaN:NaN timestamps via SSE envelope shaping Summary

**SSE replay loop now emits HubEventEnvelope-shaped JSON with ISO-8601 timestamps from a unit-tested dbRowToEnvelope helper, killing the NaN:NaN render on every historical agent message**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-27T17:39:00Z
- **Completed:** 2026-04-27T17:45:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 edited)

## Accomplishments

- Pure `dbRowToEnvelope(row, tenantId)` helper at `apps/web/lib/sse-envelope.ts` mapping Drizzle events rows to `HubEventEnvelope` (`createdAt → timestamp`, `metadata: null → omitted`, no DB `id` leak).
- Six unit tests at `apps/web/lib/sse-envelope.test.ts` covering ISO-8601 timestamp mapping, tenantId injection from outer scope, null metadata coercion, present-metadata pass-through, full Zod-schema validation via `HubEventEnvelope.parse`, and DB-id omission.
- SSE replay loop in `apps/web/app/api/runs/[id]/stream/route.ts` switched from `JSON.stringify(event)` to `JSON.stringify(dbRowToEnvelope(event, tenantId))`. Live Redis-published path is byte-for-byte unchanged.
- Full web vitest suite passes (119/119) — no regressions in any other test.
- `tsc --noEmit` for `@beagle-console/web` exits clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dbRowToEnvelope helper + unit tests** — `8d63e61` (feat)
2. **Task 2: Wire dbRowToEnvelope into the SSE replay loop** — `5426a31` (fix)

## Files Created/Modified

- `apps/web/lib/sse-envelope.ts` — created. Pure helper exporting `dbRowToEnvelope` and `EventDbRow` interface. Centralizes the createdAt → timestamp mapping and the JSONB null → undefined coercion that the Zod `.optional()` field requires.
- `apps/web/lib/sse-envelope.test.ts` — created. Six vitest cases including a real `HubEventEnvelope.parse(env)` round-trip that proves Zod compliance.
- `apps/web/app/api/runs/[id]/stream/route.ts` — modified. Added `import { dbRowToEnvelope } from '@/lib/sse-envelope'`. Replay loop body now constructs an envelope and serializes it; Redis live path untouched.

## Decisions Made

- **Helper extraction over inline mapping** — the plan listed inline as an option but the unit-test acceptance criteria force extraction; chose the helper path which yields cleaner route code and independent test coverage.
- **Cast JSONB at the boundary** — Drizzle infers JSONB columns as `unknown`. Two options: narrow at call site or cast inside the helper. Cast inside the helper keeps the route unaware of the JSON-shape assumption, which is documented adjacent to the cast.
- **Drop `metadata` property when null, do not substitute `{}`** — explicitly per plan constraints. Empty object is semantically different and would corrupt downstream consumers that distinguish present-empty from absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixtures used UUIDs that failed Zod v4's strict UUID format**

- **Found during:** Task 1 (initial vitest run)
- **Issue:** The plan specified fixture UUIDs `11111111-1111-1111-1111-111111111111` and `22222222-...-2222-...`. Zod v4's `z.string().uuid()` enforces the formal UUID syntax which requires `[1-8]` for the version nibble AND `[89abAB]` for the variant nibble. The repeated-1s/2s shape passes neither, so the `HubEventEnvelope.parse(env)` test failed with "Invalid UUID" on `runId` and `tenantId`.
- **Fix:** Promoted both fixtures to valid UUID v4 by setting the version nibble to `4` and the variant nibble to `8`: `11111111-1111-4111-8111-111111111111` and `22222222-2222-4222-8222-222222222222`. Same uniform-digit visual identity, now Zod-valid.
- **Files modified:** `apps/web/lib/sse-envelope.test.ts`
- **Verification:** `corepack pnpm --filter @beagle-console/web exec vitest run lib/sse-envelope.test.ts` — 6/6 pass.
- **Committed in:** `8d63e61` (Task 1 commit, before push)

**2. [Rule 1 - Bug] tsc rejected EventDbRow's strict content/metadata types against Drizzle's unknown JSONB inference**

- **Found during:** Task 2 (after wiring helper into route, running full tsc)
- **Issue:** `EventDbRow.content: Record<string, unknown>` and `metadata: Record<string, unknown> | null` did not assign from Drizzle's `select()` result, where JSONB columns are inferred as `unknown`. tsc error: `Type 'unknown' is not assignable to type 'Record<string, unknown>'`.
- **Fix:** Widened `EventDbRow.content` and `EventDbRow.metadata` to `unknown`, and moved the `Record<string, unknown>` cast inside `dbRowToEnvelope` (one cast for content, one for metadata in the present branch). Documented the assumption with an inline comment that ties the cast to `EventStore.persist` always writing objects.
- **Files modified:** `apps/web/lib/sse-envelope.ts`
- **Verification:** `corepack pnpm --filter @beagle-console/web exec tsc --noEmit` exits 0; full vitest suite still passes 119/119.
- **Committed in:** `5426a31` (Task 2 commit, alongside the route change)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** Both deviations are local to my plan's files; neither affects scope. The UUID fixture issue is a plan-time oversight on Zod v4 strictness; the type-relaxation issue is the standard tradeoff between narrowing Drizzle's `unknown` JSONB inference at the call site vs the helper boundary, and the chosen approach matches the plan's constraint that mapping logic stays inside the helper. No scope creep.

## Issues Encountered

- The local environment had no global `pnpm`. Resolved by invoking `corepack pnpm` (corepack ships with Node 24 and respects the `packageManager: pnpm@10.33.0` declaration in the root `package.json`). Reported `pnpm` and `corepack pnpm` are equivalent in this project; no PATH or install changes were made.

## User Setup Required

None — pure code change. Manual visual verification (open any historical run, confirm relative timestamps render) is deferred to deploy plan 14-04 per the plan's `<done>` for Task 2.

## Next Phase Readiness

- 14-01 closes UAT-14-01 in code. The fix is independent of 14-02 (different file, different subsystem) and 14-03 (DB backfill).
- 14-04 (deploy + smoke test) will provide the only remaining verification: a real historical run rendered with non-NaN timestamps in the production console.
- No blockers. No new dependencies. No threat-model surface added (per plan: bug fix on existing handler; payload now includes `tenantId` already known to the authenticated client).

## Self-Check: PASSED

- `apps/web/lib/sse-envelope.ts` — FOUND
- `apps/web/lib/sse-envelope.test.ts` — FOUND
- `apps/web/app/api/runs/[id]/stream/route.ts` — FOUND (modified)
- Commit `8d63e61` (feat 14-01: helper + tests) — FOUND in git log
- Commit `5426a31` (fix 14-01: wire envelope) — FOUND in git log
- 6/6 helper unit tests pass; 119/119 full web vitest suite passes; tsc exits 0.

---
*Phase: 14-track-b-bugs-lifecycle-and-timestamps*
*Completed: 2026-04-27*
