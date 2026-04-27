---
phase: 12-ui-polish-from-phase-11-uat
plan: 03
subsystem: ui
tags: [react, tailwind, transcript, writers-room, skeleton, loading-state, agent-config]

# Dependency graph
requires:
  - phase: 12-ui-polish-from-phase-11-uat
    provides: Plan 02 — Herman + Sam added to AGENT_CONFIG (commit c2a8b8b); chipBgClass speaker-chip styling
  - phase: 05-transcript-ui
    provides: MessageList virtualized rendering pipeline with eventOrder.length === 0 empty-state branch
  - phase: 04-06
    provides: AgentAvatar + getAgentConfig primitives consumed by the skeleton
provides:
  - WritersRoomSkeleton component (apps/web/components/transcript/loading-skeleton.tsx)
  - Empty-state replacement in MessageList: 3 named agent placeholders + "getting ready…" subtitle instead of "Waiting for events..."
  - formatAgentList pure helper (inlined in loading-skeleton.tsx) producing Oxford-comma "X, Y, and Z" strings from agent IDs
affects: [12-04, 12-05, future writers-room polish, any future plan adding agents to AGENT_CONFIG]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-derived empty-state: skeleton component reads only from a hardcoded id list + AGENT_CONFIG, no run-store / SSE coupling"
    - "Decorative skeleton bars marked aria-hidden so the announced state is the italic 'thinking…' line, not a meaningless content placeholder"
    - "Subtitle text generated from the same hardcoded id list via a pure helper so the list and the prose can never drift"

key-files:
  created:
    - apps/web/components/transcript/loading-skeleton.tsx
  modified:
    - apps/web/components/transcript/message-list.tsx

key-decisions:
  - "[Phase 12]: Hardcode Mo/Jarvis/Herman in WritersRoomSkeleton (12-03) — no backend 'expected agents' signal exists; future routing changes update this list and AGENT_CONFIG together."
  - "[Phase 12]: Skeleton inlines a local SkeletonRow component instead of rendering a fake AgentMessage event (12-03) — avoids touching the trust model and avoids crashes on event.content.text."
  - "[Phase 12]: Subtitle generated via formatAgentList helper (12-03) — single source of truth for the id list, no string drift if agents change."

patterns-established:
  - "Empty-state surfaces stay pure-derived: trigger predicate (eventOrder.length === 0) lives in MessageList, the rendered surface lives in a sibling component with no store reads"
  - "Decorative pulse bars use aria-hidden + an italic 'thinking…' label so screen-reader output stays meaningful while the visual carries the load"

requirements-completed: [UAT-12-02]

# Metrics
duration: 2min
completed: 2026-04-27
---

# Phase 12 Plan 03: Writers' Room Loading Skeleton Summary

**Replaced the bare "Waiting for events..." empty state in MessageList with a 3-row skeleton (Mo/Jarvis/Herman avatars, names, "thinking…" lines, pulsing message-text bars) plus a "Mo, Jarvis, and Herman are getting ready…" subtitle — closing UAT-12-02.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-27T13:50:23Z
- **Completed:** 2026-04-27T13:52:29Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- New presentational component `WritersRoomSkeleton` renders three agent placeholders using the real `AgentAvatar` + `getAgentConfig`, automatically picking up Plan 02's Herman config (purple-400 name, purple-500 avatar, capital "H" initial).
- MessageList's `eventOrder.length === 0` branch now returns `<WritersRoomSkeleton />` — same trigger predicate, same placement, but the loading state reads as "loading" instead of "broken."
- Subtitle "Mo, Jarvis, and Herman are getting ready…" is generated from the same hardcoded id list via the pure `formatAgentList` helper, so the id list and the prose can never drift apart.
- Pulsing skeleton bars use Tailwind `animate-pulse` on `bg-white/5` (no plugin, no new tokens) and are marked `aria-hidden` so assistive tech announces only the meaningful "thinking…" status.
- Once any event arrives via SSE, `eventOrder.length` becomes 1 and the existing `Virtuoso`-driven render path takes over with zero further changes — virtualization, scenes, collapse folds, follow-output behavior all untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WritersRoomSkeleton component** — `0b84ea6` (feat)
2. **Task 2: Wire WritersRoomSkeleton into MessageList empty-state branch** — `db167a0` (feat)

## Files Created/Modified

- `apps/web/components/transcript/loading-skeleton.tsx` (created, 73 lines) — exports `WritersRoomSkeleton`; inlines `SkeletonRow` and the pure `formatAgentList` helper; hardcoded `SKELETON_AGENT_IDS = ['mo', 'jarvis', 'herman']`.
- `apps/web/components/transcript/message-list.tsx` (modified, +2/−5) — added `import { WritersRoomSkeleton } from './loading-skeleton'`; replaced the 6-line "Waiting for events..." `<div>` with `return <WritersRoomSkeleton />;`. Virtuoso pipeline, `detectCollapsibleRanges`, `SceneDivider`, `CollapseFold`, `renderEvent`, `useRunStore`, `isAtBottom`/`followOutput` all untouched.

## Decisions Made

- **Hardcode Mo/Jarvis/Herman, no run-store coupling.** Followed CONTEXT.md `<decisions>` §Defect 2 verbatim — the project has no backend "expected agents" signal yet, and inventing one for a decorative skeleton would dirty the trust model. Future routing changes will update `SKELETON_AGENT_IDS` and `AGENT_CONFIG` together.
- **Inline a local `SkeletonRow` rather than render a fake `AgentMessage` event.** Reusing `AgentMessage` would have required fabricating a `HubEventEnvelope` with `content.text`, which crashes on the existing `content.text ?? JSON.stringify(event.content)` fallback path in subtle ways and would couple the empty-state surface to the wire format. The local `SkeletonRow` mirrors `AgentMessage`'s flex layout but uses plain text + a pulse bar so it visually reads as a placeholder.
- **Subtitle generated from the id list via `formatAgentList`.** A literal hardcoded subtitle would silently drift if a future plan added a fourth agent to `SKELETON_AGENT_IDS`. The helper enforces single-source-of-truth — change the list, the prose follows.
- **No animation timeout / fade-in.** CONTEXT.md does not request fade-in; adding one would expand the diff and the test surface for no UAT benefit. Pulse-on-mount is sufficient signal.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with the literal contents specified in the plan's `<action>` blocks; no Rule 1/2/3 auto-fixes were needed; no architectural questions surfaced.

## Issues Encountered

- The shell environment (Git Bash on Windows) does not expose `pnpm` directly on `PATH`, only via `corepack`. Used `corepack pnpm --filter @beagle-console/web exec tsc --noEmit` and `corepack pnpm --filter @beagle-console/web exec vitest run` in place of the bare `pnpm` commands listed in the execution context. Both verification commands exited 0 (tsc clean; vitest 54/54 tests passed). This is a local-environment quirk, not a plan deviation — it does not affect downstream consumers, CI, or the deployment story.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- UAT-12-02 closed. The Writers' Room loading state now reads as "loading" with three named agents + a "getting ready…" subtitle.
- Pattern established: empty-state surfaces stay pure-derived (trigger predicate in the parent, rendered surface in a sibling with no store reads). Future polish plans for other empty states (Timeline, Boardroom, Canvas) can copy this shape.
- No blockers for Plans 12-04 / 12-05.

## Self-Check: PASSED

- `apps/web/components/transcript/loading-skeleton.tsx` — FOUND
- `apps/web/components/transcript/message-list.tsx` — FOUND (modified)
- Commit `0b84ea6` (Task 1) — FOUND in `git log --oneline --all`
- Commit `db167a0` (Task 2) — FOUND in `git log --oneline --all`
- `corepack pnpm --filter @beagle-console/web exec tsc --noEmit` — exit 0
- `corepack pnpm --filter @beagle-console/web exec vitest run` — 54/54 tests pass
- Working tree clean after both commits

---
*Phase: 12-ui-polish-from-phase-11-uat*
*Completed: 2026-04-27*
