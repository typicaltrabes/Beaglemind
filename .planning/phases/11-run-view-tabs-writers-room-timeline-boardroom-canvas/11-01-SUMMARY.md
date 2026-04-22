---
phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
plan: 01
subsystem: ui

tags:
  - tabs
  - base-ui
  - url-state
  - transcript
  - agent-colors
  - run-view

# Dependency graph
requires:
  - phase: 05-transcript-ui
    provides: TldrBanner, MessageList, AgentMessage, PlanCard, QuestionCard, ArtifactCard, scene grouping, CollapseFold
  - phase: 06-clean-studio-modes
    provides: useMode (clean/studio) + DashboardShell; run-page header with Share/Stop/InterruptButton stays untouched

provides:
  - Tabs primitive (components/ui/tabs.tsx) wrapping @base-ui/react/tabs
  - getAgentColor(agentId) shared tailwind palette helper (lib/agent-colors.ts) with vitest coverage
  - renderEvent(event, runId) pure transcript renderer (components/transcript/render-event.tsx) consumed by MessageList today, ready for Timeline/Boardroom tomorrow
  - RunViewTabs URL-synced switcher between Writers' Room, Timeline, Boardroom, Canvas (?view= query param, default writers-room with canonical URL cleanup)
  - WritersRoomView wrapper composing TldrBanner + MessageList
  - Run page wired to RunViewTabs; Composer stays mounted below all four panels
  - data-testid anchors (run-view-timeline / -boardroom / -canvas) for Wave 2 plans to target

affects:
  - 11-02-PLAN (Timeline view consumes renderEvent + getAgentColor + timeline panel slot)
  - 11-03-PLAN (Boardroom view consumes renderEvent + getAgentColor + boardroom panel slot)
  - 11-04-PLAN (Canvas view consumes artifact-preview-panel + canvas panel slot)
  - 11-05-PLAN (deploy + UAT)

# Tech tracking
tech-stack:
  added:
    - '@base-ui/react/tabs primitive (already in deps, first usage)'
  patterns:
    - 'URL as single source of truth for per-run UI state (?view=<tab>) via useSearchParams + router.replace({ scroll: false })'
    - 'Whitelist-based query-param parsing (parseView) with silent fallback (invalid values do not mutate URL — T-11-01 mitigation)'
    - 'Canonical URL cleanup: default tab removes the query param rather than echoing it'
    - "Pure renderEvent helper as the single source of truth for transcript event rendering across tabs"
    - "Agent color switch (tree-shake-friendly, explicit) returning tailwind palette classes distinct from AGENT_CONFIG.bgColor hex classes"

key-files:
  created:
    - apps/web/components/ui/tabs.tsx
    - apps/web/lib/agent-colors.ts
    - apps/web/lib/agent-colors.test.ts
    - apps/web/components/transcript/render-event.tsx
    - apps/web/components/run-views/run-view-tabs.tsx
    - apps/web/components/run-views/writers-room-view.tsx
  modified:
    - apps/web/components/transcript/message-list.tsx
    - apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx

key-decisions:
  - "URL canonical form: default tab (writers-room) has no ?view= param; invalid values fall back silently without echoing into the URL"
  - "renderEvent extracted as a pure function (not a React component) — it already returns React.ReactNode, so calling as a function keeps the 5-branch switch behavior identical to the pre-extraction inline helper"
  - "Agent color palette classes (bg-amber-500 etc.) kept separate from AGENT_CONFIG.bgColor (arbitrary hex like bg-[#f7b733]) — Timeline/Boardroom want palette swatches, AgentMessage avatars want the branded hex"
  - "Sentinel uses bg-purple-400 (matches AGENT_CONFIG.nameColor parity) despite CONTEXT only listing Mo/Jarvis/user/unknown"

patterns-established:
  - "Per-tab URL sync pattern: whitelist → parseView → router.replace with { scroll: false } and canonical-default cleanup"
  - "Transcript view composition: per-tab wrapper components (WritersRoomView, future Timeline/Boardroom/Canvas) compose shared primitives under a single Tabs shell"
  - "data-testid=\"run-view-<tab>\" on each TabsPanel as a stable anchor for downstream plans"

requirements-completed:
  - VIEW-01
  - VIEW-02
  - VIEW-03

# Metrics
duration: 4min
completed: 2026-04-22
---

# Phase 11 Plan 01: Run-view Tabs Scaffold + Writers' Room Summary

**Four-tab URL-synced run-view switcher (Writers' Room / Timeline / Boardroom / Canvas) with Writers' Room wired as the default; ships shared renderEvent and getAgentColor helpers that Wave 2 tabs will consume.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T12:41:23Z
- **Completed:** 2026-04-22T12:45:10Z
- **Tasks:** 2 (Task 1 executed as TDD RED → GREEN, Task 2 as feat)
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- Tabs primitive (`components/ui/tabs.tsx`) over `@base-ui/react/tabs` — first Tabs usage in the project, follows the existing dialog/collapsible data-slot pattern.
- `getAgentColor` helper with 7 vitest assertions (case-insensitive, covers Mo/Jarvis/Sentinel/user/unknown/empty).
- `renderEvent(event, runId)` extracted from MessageList as a pure renderer — MessageList now imports it; Timeline and Boardroom (plans 02/03) will reuse it verbatim.
- `RunViewTabs` URL-synced switcher with canonical-URL cleanup (default tab strips `?view=` rather than echoing it) and whitelist-guarded parseView that silently falls back on invalid input.
- `WritersRoomView` wrapper composing `TldrBanner + MessageList` — visually identical to the pre-tabs run page.
- Run page rewired: header, ProcessDrawer (desktop + mobile), FAB, Composer, and ShareDialog all untouched; only the `<TldrBanner /> + <MessageList />` block is replaced by `<RunViewTabs />`.
- Timeline/Boardroom/Canvas placeholder panels carry stable `data-testid` anchors for Wave 2 plans.

## Task Commits

1. **Task 1 (RED): failing agent-colors test** — `df41388` (test)
2. **Task 1 (GREEN): Tabs + getAgentColor + renderEvent + message-list refactor** — `d74fe9f` (feat)
3. **Task 2: RunViewTabs + WritersRoomView + run page wiring** — `3edd999` (feat)

_Task 1 followed the TDD gate (RED then GREEN); no REFACTOR commit was needed — the implementation is small and already final._

## Files Created/Modified

- `apps/web/components/ui/tabs.tsx` — thin wrapper over `@base-ui/react/tabs` exporting `Tabs`, `TabsList`, `TabsTab`, `TabsPanel` with data-slot attributes and the project's dark theme classes (border-white/10, bg-muted/40, data-[selected]:bg-background).
- `apps/web/lib/agent-colors.ts` — `getAgentColor(agentId)` switch returning `bg-amber-500` / `bg-teal-500` / `bg-purple-400` / `bg-blue-400` / `bg-gray-500`. Case-insensitive; null-safe on empty/undefined input.
- `apps/web/lib/agent-colors.test.ts` — 7 vitest assertions (1 per behavior case in the plan).
- `apps/web/components/transcript/render-event.tsx` — pure `renderEvent(event, runId)` with the 5-branch switch (plan_proposal, question, artifact, agent_message, state_transition). Hosts the inlined `StateTransitionMessage` component moved out of message-list.
- `apps/web/components/transcript/message-list.tsx` — removed the inline `renderSingleEvent` and `StateTransitionMessage`; imports `renderEvent` from `./render-event`; two call sites (`CollapseFold.renderEvent` prop and the `event` branch of `renderItem`) now call `renderEvent(events[seq], runId)`. Behavior-preserving refactor.
- `apps/web/components/run-views/run-view-tabs.tsx` — `'use client'` component. Tab value whitelist (`writers-room | timeline | boardroom | canvas`), `parseView` fallback, `useSearchParams + useRouter + usePathname`, `router.replace(..., { scroll: false })`, canonical URL cleanup on default, placeholder panels with `data-testid` anchors.
- `apps/web/components/run-views/writers-room-view.tsx` — `'use client'` wrapper composing `<TldrBanner /> + <MessageList runId={runId} />` inside `flex flex-1 min-h-0 flex-col`.
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — dropped direct `MessageList`/`TldrBanner` imports, added `RunViewTabs`; replaced the transcript block with `<RunViewTabs runId={runId} />`. Header, drawer, FAB, Composer, and ShareDialog positions unchanged.

## Decisions Made

- **URL canonical form (default tab has no query param):** Writing `?view=writers-room` on the default tab would pollute every run link. Instead, `handleChange` deletes the param for the default and only sets it for non-default tabs. CONTEXT.md treats the URL as source of truth; this keeps that property without reflecting redundant state.
- **Silent fallback on invalid `?view=` values:** T-11-01 in the threat model asked for whitelist-guarded parsing; we do not write back to the URL when rejecting a value. User-supplied strings never reach the DOM as text or attribute values (they only enter `parseView` which throws them away).
- **`renderEvent` is a function, not a component:** It already returned `React.ReactNode` pre-extraction, and keeping it a function preserves the exact call-site ergonomics inside MessageList's virtualized `renderItem`.
- **Sentinel color:** CONTEXT.md §Agent color map listed Mo/Jarvis/user/unknown. Sentinel (`bg-purple-400`) was added to parity-match `AGENT_CONFIG.nameColor.sentinel = 'text-purple-400'`; without it, future Timeline/Boardroom plans would render Sentinel as "unknown gray" despite a known branded color.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria pass; `pnpm exec vitest run` shows 18/18 green and `pnpm exec tsc --noEmit` exits 0.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 2 plans (11-02, 11-03, 11-04) can develop in parallel:
  - 11-02 (Timeline) drops into the `data-testid="run-view-timeline"` panel and imports `renderEvent` + `getAgentColor`.
  - 11-03 (Boardroom) drops into the `data-testid="run-view-boardroom"` panel and imports the same helpers.
  - 11-04 (Canvas) drops into the `data-testid="run-view-canvas"` panel and reuses `ArtifactPreviewPanel` inline.
- Writers' Room is visually/behaviourally identical to the pre-phase run page — no transcript regression introduced (TRAN-07 preserved).
- Composer remains mounted below tab content in all four tabs — users can send messages while inspecting any view.

## Self-Check: PASSED

- `apps/web/components/ui/tabs.tsx` — FOUND
- `apps/web/lib/agent-colors.ts` — FOUND
- `apps/web/lib/agent-colors.test.ts` — FOUND
- `apps/web/components/transcript/render-event.tsx` — FOUND
- `apps/web/components/run-views/run-view-tabs.tsx` — FOUND
- `apps/web/components/run-views/writers-room-view.tsx` — FOUND
- `apps/web/components/transcript/message-list.tsx` — MODIFIED (renderEvent import added; StateTransitionMessage + renderSingleEvent removed)
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — MODIFIED (RunViewTabs wired)
- Commits `df41388`, `d74fe9f`, `3edd999` — all FOUND in `git log`
- `pnpm exec vitest run` — 18/18 passed
- `pnpm exec tsc --noEmit` — exit 0

---
*Phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas*
*Completed: 2026-04-22*
