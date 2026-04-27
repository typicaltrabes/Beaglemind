---
phase: 16-visual-overhaul
plan: 03
subsystem: ui
tags: [run-history, kpi, summary, drizzle, tanstack-query, lucide, tailwind, vitest]

requires:
  - phase: 02
    provides: requireTenantContext + getTenantDb tenant scoping helpers
  - phase: 07
    provides: events.metadata->>'costUsd' subquery pattern for tenant-scoped cost aggregation
  - phase: 14-01
    provides: HubEventEnvelope cost metadata field shape that flows into events.metadata
  - phase: 16-01
    provides: <Breadcrumb /> component already mounted at the top of /runs (preserved)
  - phase: 16-02
    provides: useRunHistory({ agent }) param + /api/runs/history?agent= EXISTS-subquery filter

provides:
  - "GET /api/runs/history/summary returning { totalRuns, totalSpendUsd, avgCostUsd, completedToday } scoped to caller's tenant"
  - "useRunHistorySummary TanStack Query hook (30s staleTime, optional agent filter)"
  - "<KpiCard /> shared tile component (label + lucide icon + tabular-nums big number + sub-label + skeleton loading state)"
  - "<RunHistorySummary /> 4-tile responsive grid (1 col mobile / 4 col desktop)"
  - "Run History table pill-style status chips (rounded-full) + group-hover chevron-right column"
  - "/runs page reads ?agent= from useSearchParams, forwards to useRunHistory + useRunHistorySummary, surfaces dismissible filter pill next to title"

affects: [16-06]

tech-stack:
  added: []
  patterns:
    - "KPI summary endpoint: count(*) + correlated coalesce/sum subquery on events.metadata->>'costUsd' + start-of-today UTC threshold; tenant-scoped via requireTenantContext + getTenantDb"
    - "URL-driven filter forwarding: useSearchParams().get('agent') ?? undefined → both data hooks; dismissible pill with router.push('/runs') to clear"
    - "Loading-skeleton-as-child pattern: <KpiCard isLoading /> swaps the value <div> for an animate-pulse skeleton, keeping label + sub-label mounted so strip height stays constant"
    - "Tailwind row-hover affordance: group/row on <tr> + opacity-0 transition-opacity group-hover/row:opacity-100 on the chevron <td>"

key-files:
  created:
    - apps/web/app/api/runs/history/summary/route.ts
    - apps/web/lib/hooks/use-run-history-summary.ts
    - apps/web/components/runs/kpi-card.tsx
    - apps/web/components/runs/run-history-summary.tsx
  modified:
    - apps/web/components/runs/run-history-table.tsx
    - apps/web/app/(dashboard)/runs/page.tsx

key-decisions:
  - "[Phase 16-03]: KPI summary endpoint computes avgCostUsd = totalSpendUsd / completedRuns rather than per-completed-run avg over events. The sum-then-divide route is one DB round-trip and matches the user-facing intuition (whole-tenant spend ÷ whole-tenant completed run count)."
  - "[Phase 16-03]: completedToday uses runs.updatedAt >= start-of-today-UTC because runs has no completedAt column. Single-region BeagleHQ deployment makes UTC alignment intentional per CONTEXT.md."
  - "[Phase 16-03]: Spend subquery joins back through runs.id IN (SELECT runs.id FROM runs WHERE <where>) so the agent EXISTS filter scopes the SUM correctly when ?agent= is set. Tile sub-labels stay generic to avoid over-promising the precise scope."
  - "[Phase 16-03]: Hook query key includes the full params object (['runs', 'history', 'summary', params]) so the cache splits cleanly between agent-filtered and global views — no manual invalidation needed when the user clears the filter."
  - "[Phase 16-03]: KPI strip stays mounted during fetch (skeleton inside each tile, not strip-level) so the table below renders independently — meets the 'does not block the table below' criterion without a separate placeholder strip."

patterns-established:
  - "Summary-style aggregate endpoint co-located under the resource it summarizes (apps/web/app/api/<resource>/summary/route.ts) — same auth scoping, same regex-validated agent filter, single-row SELECT result"
  - "<KpiCard label, value, subLabel, Icon, isLoading /> as the canonical KPI tile shape — reusable across other dashboards (operator console, project drill-down) without forking"
  - "Filter pill UX next to page title: rounded-full bg-amber-500/15 text-amber-400 + × button with aria-label='Clear …' + router.push to a clean URL"

requirements-completed: [UAT-16-03]

duration: 3min
completed: 2026-04-27
---

# Phase 16 Plan 03: Run History KPI Strip Summary

**4-tile KPI strip backed by a new `/api/runs/history/summary` endpoint, plus pill-style status chips and group-hover chevron on the Run History table, plus URL-driven `?agent=` forwarding so a sidebar AgentRow click filters both the table and the summary.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-27T19:08:00Z (after 16-02 landed)
- **Completed:** 2026-04-27T19:10:40Z
- **Tasks:** 2
- **Files modified:** 6 (4 new, 2 edited)

## Accomplishments

- New `GET /api/runs/history/summary` endpoint:
  - Tenant-scoped via `requireTenantContext()` + `getTenantDb(tenantId)`.
  - Returns `{ totalRuns, totalSpendUsd, avgCostUsd, completedToday }`.
  - `totalSpendUsd` aggregates `events.metadata->>'costUsd'` across runs in scope (same JSONB accessor pattern as `apps/web/app/api/runs/history/route.ts`).
  - `completedToday` uses `runs.status='completed' AND runs.updatedAt >= start-of-today-UTC` because the schema has no `completedAt` column today.
  - Optional `?agent=<id>` filter via the same regex (`^[a-z0-9_-]{1,32}$`) + EXISTS-subquery pattern as Plan 16-02. The cost SUM joins back through `runs.id IN (SELECT runs.id FROM runs WHERE …)` so the agent scope flows into the spend tile correctly.
- New `useRunHistorySummary({ agent })` TanStack Query hook with 30s staleTime so the strip doesn't ghost on every search keystroke (search isn't piped into the summary intentionally — only `agent` is).
- New shared `<KpiCard label, value, subLabel, Icon, isLoading />` component:
  - Uppercase 10px tracking-wider label with inline lucide icon (size-3.5).
  - Big number rendered `text-2xl font-semibold tabular-nums text-foreground`.
  - Loading branch swaps the value for an `h-7 w-20 animate-pulse rounded bg-white/5` skeleton bar — keeps strip height constant across fetch.
- New `<RunHistorySummary agent? />` 4-column responsive grid (1 col mobile, 4 col `md:`) composing four KpiCards: Activity / DollarSign / TrendingUp / CheckCircle2 from lucide.
- Run History table polish:
  - Every `STATUS_VARIANT` entry gains `rounded-full` so chips render as pills instead of rounded-md rectangles.
  - Each data row gets `group/row`; new 8th column renders a `ChevronRight` with `opacity-0 transition-opacity group-hover/row:opacity-100` for the hover affordance.
  - SkeletonRow length 7 → 8 and empty-state colSpan 7 → 8 to match the new column count.
- /runs page wires the URL filter chain end-to-end:
  - `useSearchParams().get('agent') ?? undefined` → `agentParam`.
  - Forwarded into both `useRunHistory({ ..., agent: agentParam })` and `<RunHistorySummary agent={agentParam} />`.
  - When set, renders a dismissible "Agent: `<id>` ×" pill in the header row (`rounded-full bg-amber-500/15 text-amber-400`) whose × button does `router.push('/runs')` to clear.
  - `<Breadcrumb />` from Plan 16-01 stays untouched at the top of the page.

## Task Commits

Each task was committed atomically:

1. **Task 1 — Summary endpoint + hook + KpiCard + RunHistorySummary** — `c2bac58` (feat)
2. **Task 2 — Pill chips + hover chevron + ?agent= URL wiring** — `a2c7219` (feat)

## Files Created/Modified

- `apps/web/app/api/runs/history/summary/route.ts` — Tenant-scoped aggregate endpoint; single `SELECT` with three subqueries + correlated coalesce/sum on events.metadata->>'costUsd' (NEW)
- `apps/web/lib/hooks/use-run-history-summary.ts` — TanStack Query hook (`['runs', 'history', 'summary', params]`, 30s staleTime) (NEW)
- `apps/web/components/runs/kpi-card.tsx` — Shared `<KpiCard />` tile with isLoading skeleton branch (NEW)
- `apps/web/components/runs/run-history-summary.tsx` — 4-column grid composing four KpiCards (Activity / DollarSign / TrendingUp / CheckCircle2) (NEW)
- `apps/web/components/runs/run-history-table.tsx` — STATUS_VARIANT gets `rounded-full`; new chevron column; group/row hover; SkeletonRow + empty-state colSpan bumped 7 → 8 (MODIFY)
- `apps/web/app/(dashboard)/runs/page.tsx` — useSearchParams, forward `?agent=` into both hooks, mount `<RunHistorySummary agent={agentParam} />`, render dismissible filter pill (MODIFY)

## Decisions Made

- **avgCostUsd = totalSpendUsd / completedRuns (not avg over per-event costs).** Two reasons: (1) one DB round-trip vs. a separate AVG query, and (2) it matches the user-facing intuition "tenant spend ÷ tenant completed runs" — useful even when individual runs have wildly different cost shapes.
- **`runs.updatedAt` as the completion-timestamp proxy.** The schema has no dedicated `completedAt` column; per Phase 14-02, the hub flips `status` + `updatedAt` together at completion, so `updatedAt` is a faithful proxy. Documented inline so the next refactor doesn't reintroduce a separate column without realising the proxy exists.
- **UTC start-of-today.** Phase 16 is single-region (BeagleHQ Hetzner) and CONTEXT.md doesn't ask for per-tenant timezone awareness. Sub-label reads "Since 00:00 UTC" so the user knows the boundary explicitly.
- **Spend subquery joins back through `runs.id IN (SELECT runs.id FROM runs WHERE …)`.** When `?agent=mo`, the SUM aggregates the cost of *every event on Mo's runs* (including events from Jarvis/Herman/Sam if they participated in those same runs). Per CONTEXT.md the alternative ("only Mo's events on Mo's runs") would have required a second EXISTS predicate inside the subquery and isn't what users typically want when filtering — they want "the cost of runs Mo touched", not "the cost Mo herself incurred".
- **30s staleTime on the summary hook.** Long enough that the strip doesn't refetch every search keystroke (search isn't passed in, but the React component re-renders on every keystroke); short enough that newly-completed runs surface within 30s. Matches typical KPI-tile refresh cadence.
- **Filter pill rendered at the page level, not inside `<RunHistorySummary />`.** The pill is a navigation control (clear-filter), not a KPI. Keeping it next to the title makes its dismiss action discoverable and keeps the summary component pure (props-driven, no router knowledge).

## Deviations from Plan

None — both tasks executed exactly as written. The plan's `<action>` blocks were specific enough that the only judgement calls were:

- Choosing where to merge the dismissible filter pill into the existing header `<div>` — wrapped the header in `flex flex-wrap items-center gap-3` so the pill sits to the right of the title block at desktop widths and wraps below on mobile. This is a presentational choice, not a deviation.
- Importing `useRouter` alongside `useSearchParams` from `next/navigation` in a single import line (the plan suggested two import statements; combined is cleaner).

## Issues Encountered

- **Windows pnpm shim missing.** `pnpm` is not on PATH on this machine; ran the verification commands via `corepack pnpm --filter @beagle-console/web exec …` instead. Both `tsc --noEmit` and `vitest run` were executed via corepack and exited 0. Documenting because the next executor on this machine will hit the same gap.
- **Pre-existing CRLF warnings on commit.** Git emits `LF will be replaced by CRLF` notices for the four new files. No action needed — same warning fires for every new file in this repo on Windows; the working tree stays consistent.

## Threat Model Status

| Threat ID | Status |
|-----------|--------|
| T-16-03-01 (Information disclosure / cross-tenant aggregate) | Mitigated — endpoint calls `requireTenantContext()` and uses `getTenantDb(tenantId)`; the runs/events tables in `schema` are tenant-scoped so no aggregate can cross tenant boundaries |
| T-16-03-02 (Tampering / SQL injection via agent param) | Mitigated — same regex `^[a-z0-9_-]{1,32}$` then lower-cased and bound via Drizzle's parameterized `sql` template (placeholder, not string concat) — identical pattern to Plan 16-02 |
| T-16-03-03 (DoS via expensive aggregate) | Accepted — single SELECT against tenant-scoped tables; events has a `run_id` index supporting the IN-list lookup; client-side cache is 30s |
| T-16-03-04 (XSS via filter pill `agentParam`) | Mitigated — pill renders `agentParam` as a React text node (auto-escaped); the same regex constraint round-trips back through the URL |

## User Setup Required

None — no DB migrations, no new dependencies, no external service config. The endpoint is read-only, the hook adds a new TanStack Query key, and the table changes are CSS-only plus one extra `<td>` per row.

## Next Phase Readiness

- **Plan 16-06 (UAT)** can verify UAT-16-03 directly: visit /runs → see 4-tile strip → see pill-style chips → hover row → see chevron → click sidebar AgentRow → URL becomes `/runs?agent=<id>` → strip refetches with agent scope → "Agent: `<id>` ×" pill renders → click × → URL clears, both hooks refetch.
- No blockers for Plans 16-04 / 16-05 — those plans don't touch /api/runs/history/summary or /runs page state.

## Self-Check: PASSED

- `apps/web/app/api/runs/history/summary/route.ts` — FOUND
- `apps/web/lib/hooks/use-run-history-summary.ts` — FOUND
- `apps/web/components/runs/kpi-card.tsx` — FOUND
- `apps/web/components/runs/run-history-summary.tsx` — FOUND
- `apps/web/components/runs/run-history-table.tsx` — FOUND (modify, rounded-full + group/row + ChevronRight)
- `apps/web/app/(dashboard)/runs/page.tsx` — FOUND (modify, useSearchParams + RunHistorySummary mount + filter pill; Breadcrumb preserved)
- Commit `c2bac58` (Task 1 — summary endpoint + hook + KpiCard + RunHistorySummary) — FOUND
- Commit `a2c7219` (Task 2 — pill chips + hover chevron + ?agent= URL wiring) — FOUND
- `corepack pnpm --filter @beagle-console/web exec tsc --noEmit` → exit 0
- `corepack pnpm --filter @beagle-console/web exec vitest run` → 149/149 passing

---
*Phase: 16-visual-overhaul*
*Completed: 2026-04-27*
