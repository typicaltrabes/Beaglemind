---
phase: 05-transcript-ui
plan: 01
subsystem: ui
tags: [zustand, react, transcript, agent-identity, scene-grouping, tailwind]

# Dependency graph
requires:
  - phase: 04-research-sprint-workflow
    provides: "Zustand run-store, hub-events types, basic message-list"
provides:
  - "tldr_update message type in shared hub-events"
  - "Centralized agent config (colors, roles, avatars) for Mo/Jarvis/Sentinel/User"
  - "Scene grouping derived state in run-store"
  - "AgentAvatar, AgentMessage, SceneDivider components"
affects: [05-02, 05-03, 06-clean-studio-mode]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Centralized agent config lookup with fallback defaults", "Scene grouping via event metadata in Zustand derived state"]

key-files:
  created:
    - apps/web/lib/agent-config.ts
    - apps/web/components/transcript/agent-avatar.tsx
    - apps/web/components/transcript/agent-message.tsx
    - apps/web/components/transcript/scene-divider.tsx
  modified:
    - packages/shared/src/hub-events.ts
    - apps/web/lib/stores/run-store.ts

key-decisions:
  - "Scene grouping computed in deriveState (not separate selector) for reactive updates"
  - "tldr_update events excluded from messages array — metadata-only events"
  - "Non-breaking ! assertion for scene array access with Map-backed index"

patterns-established:
  - "Agent identity: use getAgentConfig(agentId) for all color/role/avatar lookups"
  - "Scene convention: metadata.sceneId/sceneName on HubEventEnvelope"
  - "Relative timestamp formatting: inline helper, no external date library"

requirements-completed: [TRAN-02, TRAN-03]

# Metrics
duration: 2min
completed: 2026-04-21
---

# Phase 5 Plan 1: Event Types + Agent Identity + Scene Grouping Summary

**Extended hub events with tldr_update and scene metadata, built agent avatar/message/divider components, added scene grouping to Zustand store**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T18:28:21Z
- **Completed:** 2026-04-21T18:30:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extended MessageType enum with tldr_update and documented scene metadata convention
- Created centralized agent-config.ts replacing inline AGENT_COLORS with full config (colors, roles, avatars, fallback)
- Added scene grouping to run-store deriveState: groups by sceneId, auto-names from first message, handles unscened fallback
- Built AgentAvatar (32px color-coded circle), AgentMessage (avatar + name + role + timestamp + text), SceneDivider (wireframe-matching horizontal lines)

## Task Commits

Each task was committed atomically:

1. **Task 1: Event types + agent config + scene grouping in run-store** - `97f7e55` (feat)
2. **Task 2: AgentAvatar + AgentMessage + SceneDivider components** - `b893f18` (feat)

## Files Created/Modified
- `packages/shared/src/hub-events.ts` - Added tldr_update to MessageType, scene metadata docs
- `apps/web/lib/agent-config.ts` - Centralized agent config with 4 agents + default fallback
- `apps/web/lib/stores/run-store.ts` - Scene interface, scene grouping in deriveState, tldrSummary tracking
- `apps/web/components/transcript/agent-avatar.tsx` - 32px color-coded circle avatar
- `apps/web/components/transcript/agent-message.tsx` - Full agent message row with relative timestamps
- `apps/web/components/transcript/scene-divider.tsx` - Horizontal-line bracketed scene header

## Decisions Made
- Scene grouping computed inside deriveState rather than as a separate selector, ensuring reactive updates on every event append
- tldr_update events are filtered out of the messages array entirely (metadata-only per D-09)
- Used non-breaking assertion (!) with Map-backed index for safe scene array access in strict TypeScript

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed strict TypeScript array access errors**
- **Found during:** Task 1 (run-store scene grouping)
- **Issue:** `scenes[sceneIndex.get(id)!]` returns `Scene | undefined` in strict mode, causing TS2532 errors
- **Fix:** Extracted index to variable and used `!` non-null assertion after Map.has() guard, or used safe access pattern for the name derivation logic
- **Files modified:** apps/web/lib/stores/run-store.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 97f7e55 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript strictness fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent identity components ready for consumption by Plans 02 (collapse fold) and 03 (virtuoso list)
- Scene grouping in store enables scene-based rendering in message list replacement
- tldr_update support enables TLDR banner component in Plan 02

---
## Self-Check: PASSED

All 6 files verified present. Both task commits (97f7e55, b893f18) verified in git log.

---
*Phase: 05-transcript-ui*
*Completed: 2026-04-21*
