---
phase: 19-free-flowing-conversation
plan: 04
subsystem: ui
tags: [continue, live-indicator, run-history, run-detail, zod, tanstack-query, tailwind, rtl]

# Dependency graph
requires:
  - phase: 19-01
    provides: multi-round runRoundTable loop the continueOnly flag piggy-backs onto (8th param)
  - phase: 19-02
    provides: idle-timeout watcher (sole writer of status='completed') so Continue button has a meaningful re-entry target
  - phase: 19-03
    provides: thinkingAgent slice on run-store that gates ContinueButton's disabled state
provides:
  - RunStartBody.continueOnly Zod field (default false) + handleRunStart skip-user-event branch
  - runRoundTable continueOnly parameter — round-1 first-agent prompt swaps "User: …" line for "{Name}, please continue the discussion above" nudge
  - POST /api/runs/[id]/continue tenant-scoped endpoint (mirrors /messages route auth pattern)
  - useContinueRun TanStack Query mutation hook
  - ContinueButton component (executing-only, disabled while round in flight)
  - LiveIndicator component (pulsing brand-orange pill, distinct from agent-roster green)
  - run-metadata-row + run-history-table integration: swap static pill → LiveIndicator on status='executing'
affects: [19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Continue affordance pattern: hub Zod flag (continueOnly) + per-route web endpoint (/continue) that proxies to /runs/start. No new event type, no new state-machine transition — re-uses existing executing→completed path"
    - "Live indicator pattern: pulsing animate-ping outer halo + solid inner dot, brand-orange (amber-500/300) tokens to distinguish run-liveness from agent-presence (presence-green)"
    - "Sentinel currentUserSequence=-1 makes the PRIOR CONVERSATION filter a no-op when continueOnly=true, feeding the FULL prior history into the first agent's prompt without a fresh user line"

key-files:
  created:
    - apps/agent-hub/src/__tests__/routes-continue-only.test.ts
    - apps/web/app/api/runs/[id]/continue/route.ts
    - apps/web/components/transcript/continue-button.tsx
    - apps/web/components/transcript/continue-button.test.tsx
    - apps/web/components/runs/live-indicator.tsx
    - apps/web/components/runs/live-indicator.test.tsx
  modified:
    - apps/agent-hub/src/http/routes.ts
    - apps/web/lib/api/hub-client.ts
    - apps/web/lib/hooks/use-run-actions.ts
    - apps/web/components/runs/run-metadata-row.tsx
    - apps/web/components/runs/run-history-table.tsx
    - apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx

key-decisions:
  - "Sentinel value -1 for currentUserSequence under continueOnly=true (instead of changing the filter signature). Keeps runRoundTable's existing single-int contract; the filter's `e.sequenceNumber !== currentUserSequence` becomes a no-op because no real sequence ever equals -1. Future-proof: real sequenceNumbers are always positive."
  - "ContinueButton always rendered when status='executing' (visible-but-disabled during in-flight rounds) instead of conditionally hidden. CONTEXT.md decision (a): avoids button flicker between rounds. Disabled state communicates the wait without dead-time."
  - "POST /api/runs/[id]/continue does an unconditional `runs.status = 'executing'` write rather than a conditional update. Idempotent on already-executing rows; covers the case where Continue is clicked right after the idle-timeout watcher fires status='completed'. Mirrors the pre-existing /messages route pattern."
  - "fetch mock typed via `as unknown as typeof fetch` (no @ts-expect-error). happy-dom doesn't ship fetch by default; the cast is the cleanest way to satisfy TypeScript without a local declaration file."

patterns-established:
  - "Continue affordance: hub Zod flag + thin proxy endpoint. No new event type, no new state-machine transition. Future similar affordances (e.g., 'restart from round N') can follow the same shape."
  - "Two pulsing indicators in the UI now coexist with distinct semantics: brand-orange = run is live (LiveIndicator), brand-green = agent is online (AgentPresenceIndicator). Color discipline is maintained by the design tokens, not by component composition."

requirements-completed: [UX-19-03, UX-19-07]

# Metrics
duration: ~25min
completed: 2026-04-30
---

# Phase 19 Plan 04: Continue Conversation + Live Indicator Summary

**Continue conversation button + pulsing brand-orange Live indicator: hub continueOnly Zod flag suppresses user-event persist and `User:` prompt line; web ContinueButton + /continue endpoint drive re-entry; LiveIndicator replaces the executing pill on run-detail header AND run-history list rows.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-30T16:13:00Z (approx)
- **Completed:** 2026-04-30T16:18:25Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 6
- **Files created:** 6

## Accomplishments

- **Hub `continueOnly` flag end-to-end.** RunStartBody Zod accepts `continueOnly: boolean` (default false). When true, handleRunStart skips the user-event persist (`agentId: 'user'` agent_message) and returns `userSequence: null`. runRoundTable accepts continueOnly as 8th positional param; round-1 first-agent prompt swaps the `User: ${userPrompt}\n\n${name}, you're first to respond` line for `${name}, please continue the discussion above`. Subsequent agents in the same round drop the empty `User: ` line from the GROUP DISCUSSION header.
- **Web `/continue` endpoint + hook.** New POST `/api/runs/[id]/continue` (tenant-scoped, requires session). Flips runs.status to executing if currently completed (covers idle-timeout-then-continue race). Calls hubClient.startRun with `continueOnly: true, prompt: ''`. `useContinueRun` exposes the mutation via TanStack Query.
- **ContinueButton component.** Visible only when status='executing'; disabled while continueRun.isPending OR run-store.thinkingAgent is non-null. "Continue conversation" → "Continuing…" label flip during the in-flight mutation. Brand-orange tokens (border-amber-500/30, bg-amber-500/10, text-amber-300) per CONTEXT.md.
- **LiveIndicator component.** Pulsing brand-orange (`bg-amber-500` solid dot inside an `animate-ping` halo, with `text-amber-300` "Live" label). Optional `compact` prop hides the label. Visually distinct from the agent-roster's brand-green AgentPresenceIndicator.
- **Integration.** run-metadata-row.tsx swaps the static green executing pill for `<LiveIndicator />` when status === 'executing'. run-history-table.tsx swaps the amber executing pill for `<LiveIndicator />` on row render. Run-detail page header gets a wrapper div hosting `<ContinueButton />` (auto-hides on non-executing so layout stays stable).

## Task Commits

1. **Task 1 RED** — `3d15e44` (test): failing routes-continue-only tests (5 cases, 3 assertions on the new flag)
2. **Task 1 GREEN** — `09a6115` (feat): RunStartBody.continueOnly Zod + handleRunStart skip-persist branch + runRoundTable continueOnly param + web hub-client.startRun signature widening
3. **Task 2 RED** — `430430f` (test): failing ContinueButton render tests (4 RTL cases)
4. **Task 2 GREEN** — `77f9b20` (feat): /continue endpoint + useContinueRun hook + ContinueButton component
5. **Task 3 RED** — `2c9c3bd` (test): failing LiveIndicator render tests (3 RTL cases)
6. **Task 3 GREEN** — `01a09b3` (feat): LiveIndicator component + run-metadata-row + run-history-table integration + run-detail page wiring

## Files Created/Modified

### Created
- `apps/agent-hub/src/__tests__/routes-continue-only.test.ts` — 5 cases (2 baseline + 3 continueOnly assertions on handleRunStart + runRoundTable)
- `apps/web/app/api/runs/[id]/continue/route.ts` — POST endpoint, tenant-scoped, proxies to hub /runs/start
- `apps/web/components/transcript/continue-button.tsx` — visibility/disabled logic + mutation wiring
- `apps/web/components/transcript/continue-button.test.tsx` — 4 RTL cases (renders / hidden / disabled / fetch on click)
- `apps/web/components/runs/live-indicator.tsx` — pulsing brand-orange pill component
- `apps/web/components/runs/live-indicator.test.tsx` — 3 RTL cases (label / compact / brand-orange tokens)

### Modified
- `apps/agent-hub/src/http/routes.ts` — Zod field, handleRunStart skip-persist branch, runRoundTable continueOnly param + prompt-build branch
- `apps/web/lib/api/hub-client.ts` — startRun method signature widened with `continueOnly?: boolean`
- `apps/web/lib/hooks/use-run-actions.ts` — added useContinueRun TanStack Query mutation hook
- `apps/web/components/runs/run-metadata-row.tsx` — render branch: executing → LiveIndicator, else → existing Badge
- `apps/web/components/runs/run-history-table.tsx` — same render branch on row status cell
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — wrapper div hosting ContinueButton below RunMetadataRow

## Decisions Made

1. **Sentinel `-1` for currentUserSequence under continueOnly=true.** handleRunStart sets userSequence to null when skipping the user-event persist; the call to runRoundTable passes `userSequence ?? -1` so the existing `e.sequenceNumber !== currentUserSequence` filter remains a single integer comparison and naturally becomes a no-op (no real sequence is -1). Avoids changing the filter signature or branching the prior-history logic; entire prior conversation flows in.
2. **ContinueButton always rendered when status='executing' (disabled, not hidden, during in-flight).** CONTEXT.md option (a): visible-but-disabled state communicates the wait without the button flickering in/out between rounds. Aligns with the LiveIndicator pulsing in the metadata row above.
3. **Unconditional `runs.status = 'executing'` write in /continue route.** Idempotent on already-executing rows; covers the idle-timeout-then-Continue race where the user clicks Continue right after the watcher flipped the row to completed. Mirrors /messages route's pre-existing pattern.
4. **`fetch` mock typed via `as unknown as typeof fetch`.** happy-dom does not ship a default fetch; the cast is cleaner than a `// @ts-expect-error` directive (which the typechecker correctly flagged as unused) and avoids a module-augmentation declaration file just for tests.

## Deviations from Plan

None of substance — plan executed exactly as written. One minor deviation worth noting:

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Removed unused `@ts-expect-error` directive in continue-button.test.tsx**
- **Found during:** Task 2 (web typecheck after GREEN implementation)
- **Issue:** `tsc --noEmit` reported `error TS2578: Unused '@ts-expect-error' directive` because `global.fetch = fetchMock` was already typeable in happy-dom env without the suppressor.
- **Fix:** Replaced `// @ts-expect-error …\nglobal.fetch = fetchMock;` with `global.fetch = fetchMock as unknown as typeof fetch;` — same runtime behavior, satisfies typechecker.
- **Files modified:** `apps/web/components/transcript/continue-button.test.tsx`
- **Verification:** `cd apps/web && corepack pnpm exec tsc --noEmit` exits 0
- **Committed in:** `77f9b20` (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — typecheck failure)
**Impact on plan:** Cosmetic; the test logic was unchanged. No scope creep.

## Issues Encountered

- **One pre-existing test failure carries over:** `apps/web/components/transcript/user-message-attachments.test.tsx` continues to fail one assertion (inline image src expects `/api/artifacts/{id}/download` but production now emits `/api/artifacts/{id}/download?inline=1` since Phase 18-01). This is documented in `.planning/phases/19-free-flowing-conversation/deferred-items.md` as out-of-scope for Phase 19 plans. No new files I touched contribute to this failure; my new tests (continue-button + live-indicator) all pass under the same vitest config.
- **No other issues.** TDD cycle ran cleanly: RED → GREEN with no rework on any of the 3 tasks. Final verification: hub 49/49 green; web 244/245 green (same single pre-existing failure).

## Verification

- `cd apps/agent-hub && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run` → 9 test files, **49 / 49 passed** ✅
- `cd apps/web && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run` → 30 test files, **244 / 245 passed** (1 pre-existing failure documented in deferred-items.md)
- Plan-required tests counts: routes-continue-only (5), continue-button (4), live-indicator (3) — all green.

## TDD Gate Compliance

All three tasks followed RED → GREEN cleanly:

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| T1: hub continueOnly | `3d15e44` (test) | `09a6115` (feat) |
| T2: ContinueButton | `430430f` (test) | `77f9b20` (feat) |
| T3: LiveIndicator | `2c9c3bd` (test) | `01a09b3` (feat) |

No REFACTOR commit was needed — initial GREEN implementations met the verify gate without follow-up cleanup.

## User Setup Required

None — all changes are first-party code; no external service configuration. Continue button surfaces automatically once a run is in `executing` status.

## Next Phase Readiness

- **Plan 19-05 / 19-06 (downstream).** ContinueButton + LiveIndicator are now in place; UAT-style smoke tests on a real running run can verify the visual cadence Lucas described in CONTEXT.md.
- **No blockers.** All three Phase 19 wave plans (19-01 substrate, 19-02 idle-timeout, 19-03 presence, 19-04 continue+live) are now committed and tested. Wave 4 (verification + UAT) can begin.
- **Pre-existing user-message-attachments test failure** still parked in `deferred-items.md`; recommend folding into a tiny follow-up plan that touches transcript attachment rendering.

---

## Self-Check: PASSED

All listed files exist on disk; all listed commits exist in `git log`. See verification block below.

*Phase: 19-free-flowing-conversation*
*Completed: 2026-04-30*
