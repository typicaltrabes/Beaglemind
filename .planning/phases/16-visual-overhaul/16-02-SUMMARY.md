---
phase: 16-visual-overhaul
plan: 02
subsystem: ui
tags: [sidebar, presence, agent-roster, drizzle, base-ui, collapsible, tooltip, vitest]

requires:
  - phase: 04
    provides: getAgentConfig single-source-of-truth for agent display name / role / colors
  - phase: 11
    provides: base-ui Tooltip render-prop pattern (TooltipTrigger render={...})
  - phase: 14-01
    provides: HubEventEnvelope.timestamp as ISO string (used by computePresence)

provides:
  - "Pure computePresence(events, eventOrder, agentId, now) helper with live/ready/offline windows"
  - "Sidebar AgentRow component (avatar + name + role + presence dot + click-to-filter)"
  - "Three-section sidebar layout: AGENTS roster / PROJECTS (collapsible) / nav-icon footer"
  - "GET /api/runs/history?agent=<id> EXISTS-subquery filter"
  - "useRunHistory({ agent }) hook param wiring"

affects: [16-03, 16-04]

tech-stack:
  added: []
  patterns:
    - "Pure-derived presence: no global store, no SSE event, walk eventOrder reverse"
    - "AgentAvatar accepts optional className override for size variants (additive)"
    - "API conditions array typed as Drizzle SQL[] so eq/inArray/or/sql fragments compose freely"

key-files:
  created:
    - apps/web/lib/presence.ts
    - apps/web/lib/presence.test.ts
    - apps/web/components/sidebar/agent-row.tsx
  modified:
    - apps/web/components/sidebar/sidebar.tsx
    - apps/web/components/sidebar/project-list.tsx
    - apps/web/components/transcript/agent-avatar.tsx
    - apps/web/app/api/runs/history/route.ts
    - apps/web/lib/hooks/use-run-history.ts

key-decisions:
  - "[Phase 16-02]: Presence computed pure-derived from useRunStore.events with a 15s tick — no new store, no SSE event, no global broadcast. 4 agents × 15s × pure function is cheap."
  - "[Phase 16-02]: AgentAvatar gained an optional className prop (additive, default size-8 preserved) so the sidebar 24px variant doesn't fork the component. Plan said 'don't create a new prop' but neither size nor className existed; adding className is the standard React pattern that least disrupts the codebase."
  - "[Phase 16-02]: Run-history conditions array re-typed from ReturnType<typeof eq>[] to Drizzle's SQL[] — composes eq/inArray/or/sql fragments without casts."
  - "[Phase 16-02]: Agent param sanitized via regex ^[a-z0-9_-]{1,32}$ + lower() in SQL — no separate index needed; SQL injection mitigated via parameterized binding."
  - "[Phase 16-02]: NavIcon uses base-ui TooltipTrigger render-prop pattern (render={<Link…/>}) so the trigger IS the link, not a wrapped child — matches Phase 11 D-04 convention."

patterns-established:
  - "Pure presence helper: accept (events, eventOrder, agentId, now) → status; walk reverse for most-recent; never fake live"
  - "Sidebar nav-icon row: TooltipProvider wraps a flex row of NavIcon components; each NavIcon uses Tooltip + TooltipTrigger render={Link}"
  - "Collapsible-wrapped section: open/onOpenChange state in parent, ChevronRight rotates 90° when open, content gap-1 mt-2"

requirements-completed: [UAT-16-02]

duration: 14min
completed: 2026-04-27
---

# Phase 16 Plan 02: Sidebar redesign Summary

**Three-section sidebar (AGENTS roster + presence dots / collapsible PROJECTS / nav-icon footer) with pure-derived presence helper and `?agent=` filter wired through `/api/runs/history` and `useRunHistory`.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-27T18:50:00Z
- **Completed:** 2026-04-27T19:04:16Z
- **Tasks:** 3
- **Files modified:** 8 (3 new, 5 edited)

## Accomplishments

- AGENTS section at the top of the sidebar with mo / jarvis / herman / sam rows — avatar (24px) + name + role + presence dot color-mapped to live (emerald, animated) / ready (amber) / offline (gray). Click navigates to `/runs?agent=<id>`.
- PROJECTS section now wrapped in a base-ui Collapsible, default closed, chevron rotates 90° on open.
- Bottom nav-icon footer (Run History / Shared Links / Questions / Settings) with hover tooltips, replacing the previous list-style links. Operator-gated Audit Log link still visible separately.
- Pure `computePresence` helper covered by 10 vitest cases (boundary checks at 60s and 30min, malformed-timestamp safety, case-insensitive matching, walks-reverse-for-most-recent).
- `GET /api/runs/history?agent=<id>` filter via tenant-scoped EXISTS subquery on `schema.events` — same access pattern as the existing artifactCount / totalCostUsd subqueries. Backward compatible (no agent = no behavior change).
- `useRunHistory({ agent })` forwards the param so Plan 16-03 can wire URL state directly into the table query.
- Mobile drawer behavior preserved: matchMedia detection, route-change auto-close, focus-trap-via-overlay all unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED — failing test for computePresence** — `23b79d7` (test)
2. **Task 1 GREEN — presence helper + AgentRow** — `3227319` (feat)
3. **Task 2 — Rewrite sidebar; wrap project-list in Collapsible** — `b992180` (feat)
4. **Task 3 — Run-history `?agent=` filter + hook param** — `d783b82` (feat)

_Note: Task 1 used TDD; the RED/GREEN cycle landed as two commits (test then feat)._

## Files Created/Modified

- `apps/web/lib/presence.ts` — pure `computePresence` walking eventOrder reverse for the most-recent event by agent (NEW)
- `apps/web/lib/presence.test.ts` — 10 vitest cases covering live/ready/offline windows + boundary cases + malformed timestamps + case-insensitive (NEW)
- `apps/web/components/sidebar/agent-row.tsx` — AgentRow with avatar + name + role + presence dot, 15s tick to refresh presence, click → `router.push(/runs?agent=<id>)` (NEW)
- `apps/web/components/sidebar/sidebar.tsx` — Three-section layout (AGENTS / PROJECTS / nav-icon footer); preserves mobile drawer + matchMedia + route-close (REWRITE)
- `apps/web/components/sidebar/project-list.tsx` — Wrapped existing list in Collapsible; chevron rotates on open; header trigger button (MODIFY)
- `apps/web/components/transcript/agent-avatar.tsx` — Added optional `className` prop (additive, default `size-8` preserved) so sidebar can render the 24px variant (MODIFY)
- `apps/web/app/api/runs/history/route.ts` — Agent param parsing + EXISTS subquery on `schema.events`; conditions retyped to `SQL[]` (MODIFY)
- `apps/web/lib/hooks/use-run-history.ts` — Optional `agent` param forwarded as `?agent=` query string (MODIFY)

## Decisions Made

- **Pure-derived presence with 15s tick.** No new SSE event type, no global presence store, no DB column. `computePresence` reads `useRunStore.events` per render; the row's interval triggers a re-render every 15s so a 'live' status decays to 'ready' to 'offline' even with no new events. Cheap for 4 agents.
- **AgentAvatar gained optional `className`.** The plan said "do NOT create a new prop" if `size` doesn't exist — but neither `size` nor `className` existed on AgentAvatar. The minimal-impact path was to add an optional `className` (additive, default behavior unchanged) so the sidebar can render the 24px variant via `size-6` without forking the component. Treated as Rule 3 (blocking) — the alternative was either a hacky scaled wrapper or rewriting AgentAvatar with a `size` prop that nothing else uses.
- **`SQL[]` typing for conditions array.** The existing `ReturnType<typeof eq>[]` was too narrow once we mix `eq`/`inArray`/`or`/`sql` fragments. Drizzle exposes `SQL` as the common return type — re-typing the array unblocks composition without casts. Imported as `type SQL` so the runtime bundle is unaffected.
- **NavIcon via base-ui Tooltip render-prop.** Followed Phase 11 D-04 convention — `TooltipTrigger render={<Link …/>}` so the trigger IS the link element rather than a wrapper. Single focusable button, no nested-button accessibility tree.
- **`/?questions=open` for the questions nav-icon.** The dashboard root doesn't currently parse this param — link still navigates to root which is where questions appear inline today. Future polish out of scope per plan note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] AgentAvatar API didn't accept `size` or `className`**
- **Found during:** Task 1 (AgentRow creation)
- **Issue:** Plan instructs to pass either `size={24}` or `className="size-6"` to render the 24px sidebar avatar. The existing `AgentAvatar` accepted neither — just `agentId`, with `size-8` hardcoded. Plan also said "do NOT create a new prop", but with no opening it was unsatisfiable.
- **Fix:** Added optional `className?: string` to `AgentAvatarProps` and applied it via `cn(...)` after the default `size-8`. Default behavior unchanged for the two existing call sites (transcript message + loading skeleton); sidebar now passes `className="size-6"` to override.
- **Files modified:** apps/web/components/transcript/agent-avatar.tsx
- **Verification:** Type-check passes, all 149 vitest tests still green, both existing AgentAvatar consumers continue to render at 32px.
- **Committed in:** `3227319` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal. The change is purely additive and non-breaking; the alternative was a brittle scaled-wrapper hack that would have broken text rendering inside the avatar. No scope creep — the prop is unused outside the sidebar.

## Issues Encountered

- During execution `tsc --noEmit` reported errors in `app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — these are owned by the parallel Plan 16-05 executor, which had landed its run-metadata test scaffolding before its full set of imports. Confirmed by inspecting the path: not in this plan's `files_modified`. After 16-05 committed `1e63079 (feat(16-05): wire RunMetadataRow + pill-style RunViewTabs)`, the final `tsc --noEmit` exited 0 cleanly across the whole package.
- Working tree contains an unstaged `apps/web/lib/agent-config.ts` modification from the parallel Plan 16-04 executor (rebrands role strings to Governance / Commercial Risk / Stress-Test / Sentinel). My code reads `getAgentConfig().role` and works with either the old or new strings — coordination point honored, no commit needed from this plan.

## TDD Gate Compliance

Task 1 followed the RED → GREEN cycle:
- RED commit: `23b79d7` — `test(16-02): add failing test for computePresence helper`
- GREEN commit: `3227319` — `feat(16-02): presence helper + sidebar AgentRow`
No REFACTOR phase needed — the GREEN implementation matched the planned shape exactly.

## Threat Model Status

| Threat ID | Status |
|-----------|--------|
| T-16-02-01 (SQL injection via agent param) | Mitigated — regex `^[a-z0-9_-]{1,32}$` then lower-cased, bound via Drizzle parameterized `sql` template (`${agentFilter}` is a placeholder, not string concat) |
| T-16-02-02 (Cross-tenant data leak) | Mitigated — route still calls `requireTenantContext()` and uses `getTenantDb(tenantId)`; agent filter only narrows within tenant schema |
| T-16-02-03 (Fake live signal) | Mitigated — `computePresence` returns 'offline' when an agent has no events and skips events with malformed timestamps; tested in `presence.test.ts` |
| T-16-02-04 (DoS via expensive EXISTS) | Accepted — same access pattern as existing artifactCount / totalCostUsd subqueries; bounded by tenant run set |

## User Setup Required

None — no DB migrations, no new dependencies, no external service config. The change is fully backwards-compatible (omitting `?agent=` produces unchanged behavior).

## Next Phase Readiness

- **Plan 16-03 (Wave 2)** can now consume `useRunHistory({ agent })` directly. The hook accepts the param; the URL is populated by the AgentRow click; Plan 16-03's job is to read `?agent=` from the page's `useSearchParams` and pass it through.
- **Plan 16-04** can rebrand role strings in `agent-config.ts` independently — sidebar reads `getAgentConfig(...).role` as a string and will pick up whatever values land.
- No blockers. Sidebar can be merged independently of Tracks 1, 3, 4, 5.

## Self-Check: PASSED

- `apps/web/lib/presence.ts` — FOUND
- `apps/web/lib/presence.test.ts` — FOUND
- `apps/web/components/sidebar/agent-row.tsx` — FOUND
- `apps/web/components/sidebar/sidebar.tsx` — FOUND (rewrite)
- `apps/web/components/sidebar/project-list.tsx` — FOUND (modify)
- `apps/web/components/transcript/agent-avatar.tsx` — FOUND (modify)
- `apps/web/app/api/runs/history/route.ts` — FOUND (modify)
- `apps/web/lib/hooks/use-run-history.ts` — FOUND (modify)
- Commit `23b79d7` (RED) — FOUND
- Commit `3227319` (GREEN — presence + AgentRow) — FOUND
- Commit `b992180` (sidebar rewrite + project-list) — FOUND
- Commit `d783b82` (history route + hook) — FOUND
- `pnpm --filter @beagle-console/web exec tsc --noEmit` → exit 0 (verified after all parallel plans had landed)
- `pnpm --filter @beagle-console/web exec vitest run lib/presence.test.ts` → 10/10 passing
- Full vitest suite (`pnpm --filter @beagle-console/web exec vitest run`) → 149/149 passing

---
*Phase: 16-visual-overhaul*
*Completed: 2026-04-27*
