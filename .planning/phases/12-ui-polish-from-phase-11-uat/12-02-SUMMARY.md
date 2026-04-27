---
phase: 12-ui-polish-from-phase-11-uat
plan: 02
subsystem: ui
tags: [react, tailwind, transcript, agent-config, speaker-chip, writers-room]

# Dependency graph
requires:
  - phase: 05
    provides: AgentMessage / AgentAvatar / getAgentConfig contract — chip styling and new entries plug into the existing render path with zero consumer changes.
  - phase: 11
    provides: Writers' Room single-column transcript that surfaced the speaker-attribution weakness this plan closes.
provides:
  - AGENT_CONFIG entries for `herman` (purple-500 avatar / purple-400 name / "open-weight researcher") and `sam` (red-500 avatar / red-400 name / role "sentinel").
  - AgentMessage speaker block now wrapped in a low-opacity chip tinted by the agent's `bgColor`, with `font-semibold` `text-[13px]` name in `nameColor` and `text-[11px]` role + timestamp.
  - `chipBgClass(bgColor)` helper that converts `bg-[#hex]` solid tokens to `bg-[#hex]/15` chip tints (regex-defended fallback for non-arbitrary tokens).
  - Cost-section "Herman" / "Sam" rows now render capitalized via the existing `getAgentConfig().displayName` lookup — no cost-section edit required.
affects: [12-03, 12-05, future agents emitting transcript messages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Speaker chip pattern: derive both background tint and text color from a single AgentConfig entry; helper maps solid bg-[#hex] tokens to /15 opacity, no agent-specific branching."
    - "Config-as-source-of-truth: adding an entry to AGENT_CONFIG is enough to make Avatar, Message, and Cost surfaces light up correctly with zero consumer edits."

key-files:
  created: []
  modified:
    - apps/web/lib/agent-config.ts
    - apps/web/components/transcript/agent-message.tsx

key-decisions:
  - "Add Herman + Sam to AGENT_CONFIG in this plan rather than waiting for Sam's first transcript appearance — avoids a follow-up plan and removes the lowercase-fallback footgun once."
  - "Two purple shades (sentinel #c86bff, herman #a855f7) coexist intentionally; avatar background is the primary visual key, name color collision is acceptable until a real-world UAT signal says otherwise."
  - "chipBgClass is a class-name string transform, not a Tailwind plugin — keeps the change to two files and avoids any tailwind.config.ts surface."
  - "Did NOT touch cost-section.tsx: it already calls getAgentConfig(agentId).displayName, so adding herman/sam to the map is the cost-row fix."

patterns-established:
  - "chip-tint-from-bgColor: a regex transforms `bg-[#hex]` to `bg-[#hex]/15` for chip backgrounds, with passthrough fallback for palette tokens — reusable for any speaker-chip-like surface."
  - "AgentMessage typography: name = font-semibold text-[13px] leading-tight in nameColor; meta (role, timestamp) = text-[11px]. Body prose unchanged at text-sm."

requirements-completed: [UAT-12-03]

# Metrics
duration: ~6min
completed: 2026-04-27
---

# Phase 12 Plan 02: Agent config completeness + speaker chip — Summary

**Closed UAT-12-03 by adding Herman + Sam to AGENT_CONFIG and restyling AgentMessage's speaker row as a tinted chip; Writers' Room single-column threads are now scannable by speaker without re-reading.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-27T13:40:30Z
- **Completed:** 2026-04-27T13:46:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Eliminated the lowercase-fallback rendering for Herman: `getAgentConfig('herman')` now returns `{ displayName: 'Herman', bgColor: 'bg-[#a855f7]', nameColor: 'text-purple-400', initial: 'H', role: 'open-weight researcher' }`.
- Added Sam ahead of his first transcript appearance with a distinct red palette and `role: 'sentinel'`, removing the follow-up plan that would otherwise have been needed.
- Speaker block in AgentMessage is now visually distinct from body prose — chip background tinted by the agent's color, semibold name, tighter typography. No agent-specific branching: a single class-name helper derives chip background from `config.bgColor` for all current and future agents.
- Cost-section row in the process drawer now renders "Mo / Jarvis / Herman / Sam" capitalized automatically because it was already calling `config.displayName` (verified by codebase read; no edit needed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add herman and sam to AGENT_CONFIG** — `c2a8b8b` (feat)
2. **Task 2: Wrap AgentMessage speaker block in tinted chip** — `a3d7d0c` (feat)

## Files Created/Modified

- `apps/web/lib/agent-config.ts` — Added `herman` and `sam` entries to `AGENT_CONFIG`. Existing entries (mo, jarvis, sentinel, user), `DEFAULT_CONFIG`, and `getAgentConfig` are unchanged.
- `apps/web/components/transcript/agent-message.tsx` — Speaker row rewritten as an inline-flex chip (`rounded-md px-2 py-0.5` with `chipBgClass(config.bgColor)`); name = `text-[13px] font-semibold leading-tight ${config.nameColor}`; role + timestamp = `text-[11px]`; body prose gets `mt-1`. Added the `chipBgClass(bgColor)` helper above the component. `AgentAvatar`, `formatRelativeTime`, imports, and the `AgentMessageProps` interface are untouched.

## Verification

- `pnpm --filter @beagle-console/web exec tsc --noEmit` exits 0 after each task.
- All Task 1 grep acceptance criteria pass (herman + sam entries with the exact specified colors, two `text-purple-400`, one `text-red-400`, six `displayName: '<Name>'` lines in the AGENT_CONFIG map, `DEFAULT_CONFIG` and `getAgentConfig` unchanged).
- All Task 2 grep acceptance criteria pass: `chipBgClass(` present, `function chipBgClass(bgColor: string): string` defined, `rounded-md px-2 py-0.5` chip wrapper present, `font-semibold` and `text-[13px] leading-tight` present, regex pattern `^bg-\[(#[0-9a-fA-F]{3,8})\]$` present, AgentAvatar / getAgentConfig / formatRelativeTime / `content.text ?? JSON.stringify(event.content)` all preserved, the prior `text-sm font-medium` is gone (count=0).
- Cost-section reviewed: already calls `getAgentConfig(agentId).displayName` (line 112 of `apps/web/components/studio/cost-section.tsx`); herman + sam will now render capitalized automatically.

## Deviations from Plan

None. The plan was executed exactly as written — both AGENT_CONFIG entries paste verbatim, both file edits stay within the scopes specified, no architectural changes, no auto-fixes, no out-of-scope work.

## Coordination Notes (parallel execution)

This plan ran in parallel with 12-01 (`globals.css`) and 12-04 (`apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` + new API route + new hook). File overlap: zero, as planned.

One transient anomaly during commit: a parallel agent's `git commit -a`/`git add -A` style sweep briefly pulled my Task 2 working-tree edit into another plan's commit. The parallel agent then rebased/cleaned its own history, leaving my Task 2 changes uncommitted again. I re-staged `apps/web/components/transcript/agent-message.tsx` explicitly and committed it as `a3d7d0c`, which is the canonical Task 2 commit. The first temporary commit (`1df59f2`) is no longer in the history (replaced via the parallel agent's clean-up rebase). Final verified state: my two intended files live in two atomic commits (`c2a8b8b`, `a3d7d0c`), each scoped to a single file, no destructive deletions in `git diff --diff-filter=D HEAD~1 HEAD`.

## Self-Check: PASSED

- `apps/web/lib/agent-config.ts` — FOUND, contains `herman: {`, `sam: {`, `displayName: 'Herman'`, `displayName: 'Sam'`, `bg-[#a855f7]`, `bg-[#ef4444]`, `text-[#1a0833]`, `text-[#3a0808]`, `initial: 'H'`, `initial: 'S'`, `role: 'open-weight researcher'`, `role: 'sentinel'`. `text-purple-400` count = 2 (sentinel + herman). `text-red-400` count = 1 (sam). `DEFAULT_CONFIG` and `getAgentConfig` unchanged.
- `apps/web/components/transcript/agent-message.tsx` — FOUND, contains `chipBgClass(`, `function chipBgClass(bgColor: string): string`, `rounded-md px-2 py-0.5`, `font-semibold`, `text-[13px] font-semibold leading-tight`, regex `^bg-\[(#[0-9a-fA-F]{3,8})\]$`. AgentAvatar import + usage preserved, getAgentConfig import + usage preserved, formatRelativeTime preserved, body `{content.text ?? JSON.stringify(event.content)}` preserved. `text-sm font-medium` count = 0 (correctly removed).
- Commit `c2a8b8b` — FOUND in `git log --oneline --all`.
- Commit `a3d7d0c` — FOUND in `git log --oneline --all`.
- `pnpm --filter @beagle-console/web exec tsc --noEmit` — exits 0.
