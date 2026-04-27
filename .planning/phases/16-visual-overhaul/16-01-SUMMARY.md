---
phase: 16-visual-overhaul
plan: 01
subsystem: web/dashboard-chrome
tags: [header, branding, breadcrumb, pulse, operator-links, tdd]
requires:
  - apps/web/lib/operator.ts (existing isOperator helper pattern)
  - apps/web/lib/stores/run-store.ts (existing eventOrder + events.timestamp ISO field)
  - packages/db (users.isOperator column + drizzle client)
  - @tanstack/react-query (already in package.json)
provides:
  - apps/web/lib/system-pulse.ts (computeSystemPulse, SystemPulseStatus, PULSE_LIVE_WINDOW_MS)
  - apps/web/app/api/me/operator/route.ts (GET endpoint)
  - apps/web/lib/hooks/use-operator.ts (useOperator hook)
  - apps/web/components/breadcrumb.tsx (Breadcrumb component)
  - dashboard-shell header upgrade (pulse + 36px logo + bold wordmark + operator links)
affects:
  - apps/web/app/(dashboard)/dashboard-shell.tsx (header rewritten)
  - apps/web/app/(dashboard)/page.tsx (Breadcrumb above all 3 returns)
  - apps/web/app/(dashboard)/runs/page.tsx (Breadcrumb above table)
  - apps/web/app/(dashboard)/shared-links/page.tsx (Breadcrumb above table)
tech-stack:
  added: []
  patterns:
    - "TanStack Query 5min staleTime for boolean session info (mirrors useUserPreferences pattern)"
    - "Pure-functional helper + colocated vitest test for time-window logic (mirrors run-title.ts / state-machine.ts pattern)"
    - "Fragment-wrapped page returns to keep Breadcrumb a peer of existing root <div>, not a parent"
key-files:
  created:
    - apps/web/lib/system-pulse.ts
    - apps/web/lib/system-pulse.test.ts
    - apps/web/lib/hooks/use-operator.ts
    - apps/web/app/api/me/operator/route.ts
    - apps/web/components/breadcrumb.tsx
  modified:
    - apps/web/app/(dashboard)/dashboard-shell.tsx
    - apps/web/app/(dashboard)/page.tsx
    - apps/web/app/(dashboard)/runs/page.tsx
    - apps/web/app/(dashboard)/shared-links/page.tsx
decisions:
  - "Pulse re-evaluation interval set to 15s — short enough that the dot decays from live to idle within one viewing-second of the 60s window expiring, long enough to avoid a setState storm. Not specified in CONTEXT, picked under Claude's Discretion."
  - "useOperator resolves 401 to false rather than throwing — the hook is rendered for every dashboard page including unauthenticated edge cases, and a thrown query rejection would surface in React Query devtools as a noisy 'always-failing' query for any logged-out user."
  - "Breadcrumb is wrapped in a fragment alongside (not above) the page-level root <div> per the plan's 'do not restructure existing content' directive. For (dashboard)/page.tsx with three early returns, each return got its own fragment — preserves all loading/empty/loaded paint paths."
  - "Operator links live in a single hidden md:flex wrapper rather than per-link mobile-hide classes — single point of toggle if mobile copy ever needs to render a different shape."
metrics:
  duration_seconds: 272
  completed: 2026-04-27T19:03:37Z
  tasks_completed: 2
  files_created: 5
  files_modified: 4
  commit_count: 2
---

# Phase 16 Plan 01: Header chrome (italic-accent wordmark + system pulse + operator LiteLLM/Grafana links + breadcrumb on dashboard pages) Summary

**One-liner:** Dashboard header now shows a 6px emerald-pulse dot (live = any run event in last 60s), a 36px ringed logo, and a bold-amber `Console` accent — operators additionally see LiteLLM + Grafana external links — and three non-run dashboard pages render a `BEAGLELABS › <PAGE>` breadcrumb directly under the header.

## Tasks Completed

| Task | Name                                                                                           | Commit  | Files                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | System pulse helper + operator API + Breadcrumb component (TDD)                                | ee27934 | system-pulse.ts, system-pulse.test.ts, use-operator.ts, app/api/me/operator/route.ts, breadcrumb.tsx                          |
| 2    | Wire pulse + operator links + bold wordmark into dashboard-shell; add Breadcrumb to 3 pages    | 3cb3784 | (dashboard)/dashboard-shell.tsx, (dashboard)/page.tsx, (dashboard)/runs/page.tsx, (dashboard)/shared-links/page.tsx           |

## What Shipped

### Pure helper — `apps/web/lib/system-pulse.ts`

`computeSystemPulse(lastEventTimestampIso, nowMs) → 'live' | 'idle'` with `PULSE_LIVE_WINDOW_MS = 60_000`. Defensive against `null`, `undefined`, `''`, `'NaN'`, and any non-parseable string — corrupt timestamps fall through to `'idle'` so a malformed event row never fakes a green pulse.

### Test coverage — `system-pulse.test.ts`

Six `it(...)` blocks: (a) null/undefined inputs, (b) malformed strings (`'NaN'`, `'not-a-date'`, `''`), (c) 30s ago (live), (d) exactly 60s ago boundary (live), (e) 90s ago (idle), (f) 1 hour ago (idle). All pass via `vitest run lib/system-pulse.test.ts`.

### Operator API — `app/api/me/operator/route.ts`

`GET /api/me/operator` reads the better-auth session via `auth.api.getSession({ headers })`, returns `401` with `{ error: 'Unauthorized' }` if no session, otherwise selects `users.isOperator` for the session-bound user id and returns `{ isOperator: boolean }`. Mirrors the existing `lib/operator.ts` `isOperator()` helper but in route-handler form (no `redirect()` calls — JSON only).

### Operator hook — `lib/hooks/use-operator.ts`

`useOperator()` returns `useQuery<boolean>` with key `['me', 'operator']` and `staleTime: 5 * 60_000` (5 minutes). 401 resolves to `false` rather than throwing, so logged-out edge-cases don't poison the React Query cache.

### Breadcrumb component — `components/breadcrumb.tsx`

Presentational `<nav aria-label="Breadcrumb">` rendering an `<ol>` of `text-[10px] font-medium uppercase tracking-wider text-muted-foreground` items separated by `›`. Trail prop is `string[]`; component is pure-presentational with no operator gating (per the plan's explicit DO NOT).

### Dashboard shell — `dashboard-shell.tsx`

- Pulse dot (6px / `size-1.5`) before the logo: emerald-500 + `animate-pulse` when live, gray-500 static otherwise. Re-evaluated every 15 s via a `setInterval` so the dot decays from live → idle even when no new events arrive.
- Logo bumped 32 → 36px, gained `ring-1 ring-amber-500/20`.
- Wordmark restructured: `Beagle Agent <em class="not-italic font-bold text-amber-400">Console</em>` at `text-[18px] font-semibold tracking-tight text-white`. The `<em>` is bold-not-italic per CONTEXT.md.
- LiteLLM + Grafana external-tool links (operator only, hidden < md): `text-xs text-muted-foreground hover:text-foreground` with a 12px lucide `ExternalLink` icon, both with `rel="noopener noreferrer"` for tabnabbing safety.

### Dashboard page breadcrumbs

- `(dashboard)/page.tsx`: `BEAGLELABS › DASHBOARD` rendered above each of the three early-return branches (loading / empty / loaded) via fragment wrappers.
- `(dashboard)/runs/page.tsx`: `BEAGLELABS › RUN HISTORY` rendered above the existing `<div className="flex flex-col gap-6 p-6">` body.
- `(dashboard)/shared-links/page.tsx`: `BEAGLELABS › SHARED LINKS` rendered above the existing body.
- `(dashboard)/projects/[projectId]/runs/[runId]/page.tsx`: deliberately left untouched (verified via grep — the run page's title row replaces the breadcrumb per CONTEXT.md).

## Verification Results

| Check                                                                              | Result                |
| ---------------------------------------------------------------------------------- | --------------------- |
| `pnpm exec vitest run lib/system-pulse.test.ts`                                    | 6/6 pass              |
| `pnpm exec tsc --noEmit` (apps/web)                                                | exit 0                |
| `apps/web/lib/system-pulse.ts` exports `computeSystemPulse` + `SystemPulseStatus`  | Confirmed             |
| `PULSE_LIVE_WINDOW_MS = 60_000` in helper                                          | Confirmed             |
| `apps/web/lib/system-pulse.test.ts` has ≥ 6 `it(...)` blocks                       | Confirmed (6 exact)   |
| `useOperator` exported from `use-operator.ts` + fetches `/api/me/operator`         | Confirmed             |
| `app/api/me/operator/route.ts` exports `GET`, contains `auth.api.getSession`, `users.isOperator`, `status: 401` | Confirmed |
| `Breadcrumb` exported, has `text-[10px]` + `uppercase` + `tracking-wider` + `›`    | Confirmed             |
| `dashboard-shell.tsx` imports `useRunStore`, `computeSystemPulse`, `useOperator`   | Confirmed             |
| `width={36}` + `ring-1 ring-amber-500/20` in shell                                 | Confirmed             |
| `<em ... not-italic font-bold text-amber-400>Console</em>` in shell                | Confirmed             |
| `data-pulse=` + `bg-emerald-500 animate-pulse` + `bg-gray-500` in shell            | Confirmed             |
| `litellm.beaglemind.ai` + `hq.beaglemind.ai` URLs present                          | Confirmed             |
| `isOperator &&` gate + `target="_blank"` + `rel="noopener noreferrer"` in shell    | Confirmed             |
| `hidden md:flex` wrapper around operator-only block                                | Confirmed             |
| `Breadcrumb` rendered on dashboard root, runs, shared-links pages                  | Confirmed             |
| `Breadcrumb` NOT rendered on `(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` | Confirmed (zero matches) |

## Deviations from Plan

None — plan executed exactly as written.

## Authentication Gates

None encountered. The new `/api/me/operator` route was implemented inside this plan; no prior auth handshake was required.

## Threat Surface

The threat register entries (T-16-01-01 through T-16-01-04) are all addressed by the implementation:

- **T-16-01-01 (IDOR on /api/me/operator):** Endpoint reads only `session.user.id` — no path/body parameter accepts another user's id. Mitigated.
- **T-16-01-02 (client-side spoofing of useOperator):** Accepted — the hook is a UX hint only; the actual operator-only data lives behind `litellm.beaglemind.ai` / `hq.beaglemind.ai` which enforce their own auth.
- **T-16-01-03 (tabnabbing):** Both external `<a>` tags carry `rel="noopener noreferrer"`. Mitigated.
- **T-16-01-04 (fake live pulse):** `computeSystemPulse` returns `'idle'` for null/undefined/empty/non-parseable timestamps — verified in 2 of the 6 test cases. Mitigated.

No new security-relevant surface was introduced beyond what the plan's threat model covers.

## Coordination With Parallel Plans

Plans 16-02 (sidebar), 16-04 (agent-config), and 16-05 (run-page metadata) ran in parallel against the same working tree. To avoid stomping on their staged changes, every commit used explicit `git add <path>` (no `git add -A` / `.`). Verified via `git diff --cached --name-only` before each commit that only this plan's files were staged.

## Self-Check: PASSED

- File `apps/web/lib/system-pulse.ts`: FOUND
- File `apps/web/lib/system-pulse.test.ts`: FOUND
- File `apps/web/lib/hooks/use-operator.ts`: FOUND
- File `apps/web/app/api/me/operator/route.ts`: FOUND
- File `apps/web/components/breadcrumb.tsx`: FOUND
- File `apps/web/app/(dashboard)/dashboard-shell.tsx`: FOUND (modified)
- File `apps/web/app/(dashboard)/page.tsx`: FOUND (modified)
- File `apps/web/app/(dashboard)/runs/page.tsx`: FOUND (modified)
- File `apps/web/app/(dashboard)/shared-links/page.tsx`: FOUND (modified)
- Commit ee27934: FOUND in `git log --all`
- Commit 3cb3784: FOUND in `git log --all`
- `vitest run lib/system-pulse.test.ts`: 6/6 pass
- `tsc --noEmit`: exit 0
