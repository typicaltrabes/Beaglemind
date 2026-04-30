---
phase: 19-free-flowing-conversation
plan: 03
subsystem: presence-sse-bridges-ui
tags: [presence, sse, bridges, ui, transcript, ux-19-05]
requirements: [UX-19-05]
requires:
  - 19-01  # multi-round runRoundTable + per-agent loop wrap point
provides:
  - "MessageType: presence_thinking_start | presence_thinking_end | presence_typing"
  - "emitPresence() helper around runRoundTable bridge calls (try/finally)"
  - "AgentPresenceIndicator component (italic muted text + 3 staggered dots)"
  - "run-store thinkingAgent slice (live presence indicator state)"
  - "message-list.tsx Footer slot wired to thinkingAgent"
affects:
  - "Web SSE consumers see 18 new presence events per 3-round run"
  - "Idle-timeout watcher (Plan 19-02) is rescheduled by every presence event (typing keeps run alive)"
tech_stack:
  added:
    - "@keyframes presence-dot-pulse CSS animation in globals.css"
  patterns:
    - "TDD RED→GREEN per task (3 task-level test commits, 3 implementation commits)"
    - "try/finally guard around bridge calls so _end fires even on synchronous throw"
    - "Last-writer-wins reducer logic in run-store for overlapping presence events"
key_files:
  created:
    - apps/agent-hub/src/__tests__/routes-presence.test.ts
    - apps/web/components/transcript/agent-presence-indicator.tsx
    - apps/web/components/transcript/agent-presence-indicator.test.tsx
    - apps/web/lib/stores/run-store.test.ts
  modified:
    - packages/shared/src/hub-events.ts
    - apps/agent-hub/src/http/routes.ts
    - apps/web/lib/stores/run-store.ts
    - apps/web/components/transcript/message-list.tsx
    - apps/web/app/globals.css
decisions:
  - "Presence events flow through MessageRouter.persistAndPublish (not a side channel) so they get sequenceNumbers + reach SSE consumers + reschedule the idle-timeout watcher uniformly"
  - "Run-store short-circuits presence events at the top of appendEvent: they drive ONLY the thinkingAgent slice; events/eventOrder stay clean (SSE replay on reconnect therefore doesn't re-render presence as transcript items)"
  - "Indicator clears on EITHER matching _end OR the agent's actual reply — defense in depth against a dropped _end"
  - "Last-writer-wins on overlapping _start (a new start always overwrites; mismatched _end is a no-op) — prevents stuck indicators on overlap or stale-end-after-new-start races"
  - "Test file uses plain Chai matchers (not jest-dom) to match the apps/web convention established in user-message-attachments.test.tsx"
metrics:
  duration_minutes: 8
  completed_at: 2026-04-30T14:07:29Z
  tasks_completed: 3
  task_commits: 6  # 3 RED + 3 GREEN
  files_created: 4
  files_modified: 5
  test_cases_added: 14  # 3 routes + 4 indicator + 7 run-store
---

# Phase 19 Plan 03: Per-Agent Presence Indicators Summary

End-to-end per-agent presence indicators (UX-19-05): widened MessageType enum, wrapped both bridges with try/finally start/end emissions, and rendered an inline `Mo is thinking…` indicator at the bottom of the transcript driven by a new `thinkingAgent` slice on the run-store.

## What Was Built

**Shared (`packages/shared/src/hub-events.ts`):**
- Widened `MessageType` enum with three new types: `presence_thinking_start`, `presence_thinking_end`, `presence_typing` (typing reserved; v1 emits only start/end). Re-built dist so apps/agent-hub and apps/web pick up the new values.

**Agent-hub (`apps/agent-hub/src/http/routes.ts`):**
- Added `emitPresence(router, tenantId, runId, agentId, phase)` helper near `loadRunConfig`. Publishes `{ type: 'presence_thinking_<start|end>', agentId, runId, content: { event: type } }` through `MessageRouter.persistAndPublish`. Wrapped in its own try/catch — a publish failure logs an error but never blocks the actual agent invocation.
- Wrapped the per-agent bridge-call block inside `runRoundTable` with `await emitPresence(...,'start')` immediately before and `await emitPresence(...,'end')` in a `finally`. The wrap surrounds the entire vision-then-fallback block AND the failure-bubble emit, so the order invariant `_start < agent_message (or failure marker) < _end` always holds.
- Wrap is INSIDE the rounds outer loop, so over 3 rounds × 3 agents we emit exactly 9 starts + 9 ends (18 presence events).

**Web — UI component (`apps/web/components/transcript/agent-presence-indicator.tsx` + `globals.css`):**
- New `AgentPresenceIndicator` component: capitalizes `agentId` (`mo` → `Mo`), renders italic muted-foreground text + 3 staggered animated dots, has `role="status"` + `aria-live="polite"` for screen readers, returns `null` for empty `agentId`.
- Appended `@keyframes presence-dot-pulse` rule + `.presence-dot-{1,2,3}` delay classes (0s / 0.2s / 0.4s) to `globals.css` for the typing-indicator rhythm.

**Web — store + list (`apps/web/lib/stores/run-store.ts` + `message-list.tsx`):**
- New `thinkingAgent: string | null` field on `RunState`; initialized to `null` in `INITIAL_STATE` so `initRun` resets it via the existing spread.
- Extended `appendEvent` (and the bulk-replay `appendEvents`) with branches:
  - `presence_thinking_start` → `set({ thinkingAgent: agentId })`, then early return (does NOT enter events/eventOrder)
  - `presence_thinking_end` matching current → `set({ thinkingAgent: null })`, early return
  - `presence_thinking_end` mismatched → no-op (defends against stale-end-after-new-start)
  - `presence_typing` → ignored entirely (reserved for future streaming bridge)
  - `agent_message` from same agent → clear `thinkingAgent` early THEN fall through to the normal append path (defense in depth against a dropped `_end`)
- `message-list.tsx` reads `thinkingAgent` and renders `<AgentPresenceIndicator>` inside Virtuoso's `components.Footer` slot. Footer returns `null` when no agent is thinking, so there's no DOM cost when idle. The Footer position keeps the indicator pinned at the bottom and `followOutput` auto-scrolls to it.

## Test Coverage Added

| Test file | Cases | What it covers |
| --- | --- | --- |
| `apps/agent-hub/src/__tests__/routes-presence.test.ts` | 3 | Single-round emission (3 starts + 3 ends, order invariant), throw-path resilience (jarvis throws → _end still fires + failure-bubble in transcript), three-round count (exactly 18 presence events) |
| `apps/web/components/transcript/agent-presence-indicator.test.tsx` | 4 | Capitalized name + thinking text, 3 dots with staggered classes, `role=status` + `aria-live=polite`, null render on empty agentId |
| `apps/web/lib/stores/run-store.test.ts` | 7 | Sets on _start, clears on matching _end, no-op on mismatched _end, clears on agent_message, last-writer-wins, presence events bypass events/eventOrder, initRun resets to null |
| **Total** | **14** | All green |

## Verification

```
$ corepack pnpm --filter @beagle-console/shared build       → OK (no errors)
$ cd apps/agent-hub && corepack pnpm exec tsc --noEmit       → OK
$ cd apps/agent-hub && corepack pnpm exec vitest run         → 39 passed (8 files)
$ cd apps/web        && corepack pnpm exec tsc --noEmit      → OK
$ cd apps/web        && corepack pnpm exec vitest run        → 237 passed, 1 pre-existing failure (deferred)
```

## Commits (in order)

| Hash | Type | Title |
| --- | --- | --- |
| `dbfaa26` | test | RED: failing presence emission tests + widen MessageType enum |
| `8372b6b` | feat | GREEN: emit per-agent presence_thinking_start/end around bridge calls |
| `b0abf0b` | test | RED: failing AgentPresenceIndicator render tests + stub component |
| `2e1cea7` | feat | GREEN: implement AgentPresenceIndicator + presence-dot CSS keyframes |
| `940836d` | test | RED: failing run-store presence tracking tests |
| `c6f2e20` | feat | GREEN: wire thinkingAgent slice into run-store + render indicator footer |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] jest-dom matchers not configured in apps/web**
- **Found during:** Task 2 GREEN
- **Issue:** Initial test file used `toBeInTheDocument()` / `toHaveClass()` / `toHaveAttribute()` from jest-dom, which would have required adding a vitest setup file + type augmentation. Existing apps/web tests (e.g. `user-message-attachments.test.tsx`) deliberately avoid jest-dom — they use plain Chai matchers + DOM queries.
- **Fix:** Rewrote the four assertions to use plain matchers (`expect(node).toBeTruthy()`, `expect(dots[0]?.classList.contains('presence-dot-1')).toBe(true)`, `expect(region.getAttribute('aria-live')).toBe('polite')`).
- **Files modified:** `apps/web/components/transcript/agent-presence-indicator.test.tsx`
- **Commit:** Folded into `2e1cea7` (T2 GREEN).

### Co-tenant uncommitted work observed

While running Task 3 verification, `git status` showed uncommitted modifications in `apps/agent-hub/{package.json, src/handlers/message-router.ts, src/index.ts}`, `pnpm-lock.yaml`, plus an untracked `apps/agent-hub/src/handlers/idle-timeout-scheduler.ts`. These are Plan 19-02's BullMQ idle-timeout scheduler in flight (not mine — confirmed by reading the file headers). Per the orchestrator's Wave 2 coordination note: "files are disjoint from 19-02 so they parallel cleanly" — I left them entirely untouched. Plan 19-02 will commit its own files when it completes.

## Deferred Issues

Tracked in `.planning/phases/19-free-flowing-conversation/deferred-items.md`:

- **Pre-existing test failure** in `apps/web/components/transcript/user-message-attachments.test.tsx` (`renders an inline <img> using the download URL for image/png attachments`). Phase 18-01 commit `487387a` added `?inline=1` to the inline image src URL but didn't update the test fixture. Out of scope for Plan 19-03; one-line follow-up.

## Authentication Gates

None encountered — fully automated TDD execution.

## Self-Check: PASSED

All 9 created/modified files exist on disk; all 6 commits are in `git log --oneline --all`.
