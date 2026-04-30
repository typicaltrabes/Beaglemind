---
phase: 19-free-flowing-conversation
plan: 05
subsystem: messaging
tags: [hub, messages, queue, mid-conversation, jsonb, drizzle, vitest]

# Dependency graph
requires:
  - phase: 19-01
    provides: runs.current_round column + multi-round outer loop in runRoundTable that bumps current_round at top of each round
  - phase: 19-04
    provides: ownership of routes.ts continueOnly path — sequential file ownership clears the way for this plan's runRoundTable patch
provides:
  - consumeQueuedMessages helper in apps/agent-hub/src/http/routes.ts — list events, filter agentId='user' + metadata.queuedForNextRound=true, concat in send-order under one `User:` prefix, atomically clear flag via jsonb_set UPDATE
  - runRoundTable round-start hook (round > 1) that prepends queued block onto the in-run transcript before the first agent fires
  - runRoundTable post-loop clear of runs.current_round = NULL so messages route can distinguish "round in flight" from "post-rounds idle"
  - PRIOR CONVERSATION block now excludes queuedForNextRound=true events (Rule 1 deviation — they would otherwise leak into round 1's prompt and double-list when consumeQueuedMessages prepends them in round 2+)
  - POST /api/runs/[id]/messages branch on runs.current_round: in-flight → INSERT event with metadata.queuedForNextRound=true (skipping hubClient.startRun), idle → existing path (status='executing' + startRun)
  - sequenceNumber computed via MAX(sequence_number)+1 with single retry on unique-violation collision with hub SequenceCounter
affects: [19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB metadata flag for queue state: `metadata.queuedForNextRound` boolean lives on the regular agent_message events row, kept in chronological place in the transcript, atomically cleared via `jsonb_set(metadata, '{queuedForNextRound}', 'false'::jsonb)` after consumption"
    - "Web-side direct event INSERT (bypassing the hub) is acceptable when paired with MAX(sequence_number)+1 retry — the unique events_run_seq_idx is the ultimate guard. Two writers (hub SequenceCounter + this route) coexist via the index; collisions are rare enough to tolerate a single retry"
    - "Round-start consumption hook: code that needs to run only on round 2+ (queue read, future inter-round side effects) gates on `if (round > 1)` inside the existing for-loop rather than peeling round 1 out of the loop body"

key-files:
  created:
    - apps/agent-hub/src/__tests__/routes-queue.test.ts
    - apps/web/app/api/runs/[id]/messages/route.test.ts
    - .planning/phases/19-free-flowing-conversation/19-05-SUMMARY.md
  modified:
    - apps/agent-hub/src/http/routes.ts
    - apps/web/app/api/runs/[id]/messages/route.ts

key-decisions:
  - "Excluded queuedForNextRound=true events from the PRIOR CONVERSATION block (Rule 1 deviation). Without this, queued user events would either (a) leak as `User:` lines in round 1's prompt — leaking future input — or (b) appear twice in round 2+ once consumeQueuedMessages also prepends them. The flag is cleared post-consumption, so consumed messages still surface in PRIOR CONVERSATION on subsequent rounds as normal user turns."
  - "MAX(sequence_number)+1 with single retry rather than coordinating with the hub SequenceCounter via a new /enqueue endpoint. Race window is small (in-flight round means at most ~3-9 hub writes per round, user typing pace is much slower), and the unique index events_run_seq_idx makes collision detectable. Threat model accepts the rare 500; documented as deferred fix."
  - "Queued event content keeps the same shape as a regular user message ({ text } or { text, attachmentIds }). No new event type. SSE replay, transcript rendering, and chip stacks all continue to work — the only thing that's different is the metadata flag, which the run-detail UI doesn't surface today (queued messages render as normal user bubbles in chronological position, per the plan's must-haves: \"the message still appears in the transcript with normal ordering\")."
  - "Queue-clear UPDATE is wrapped in try/catch — failure to clear the flag is non-blocking. Worst case: the same messages re-prepend on the next round (UAT will catch). Better than aborting the whole rounds loop on a transient DB blip."

patterns-established:
  - "Two-step `jsonb_set` for atomic flag-and-timestamp updates: `jsonb_set(jsonb_set(metadata, '{flag}', 'false'::jsonb), '{consumedAt}', to_jsonb(now()::text))`. Used here to clear queuedForNextRound and stamp consumedAt in one statement."
  - "Vitest mock for the Drizzle `db.execute(sql\`...\`)` chain: `executeSpy = vi.fn(async () => undefined)` plus a vi.hoisted block. Tests assert on call count + ordering, not the SQL fragment itself (Drizzle's sql tag returns an opaque object)."

requirements-completed: [UX-19-06]
duration-minutes: 12
---

# Phase 19 Plan 05: Mid-Conversation Message Queueing Summary

Mid-conversation messages (sent while a round is in flight) are now persisted immediately into the transcript but skip the hub's startRun call; they're picked up at the start of the next round and prepended into the GROUP DISCUSSION block as a single `User:` block. Multiple queued messages between rounds concatenate in send-order. `runs.current_round` is cleared on rounds-loop exit so the messages route can correctly route follow-up messages to either the queue or a fresh round-table.

## What changed

### `apps/agent-hub/src/http/routes.ts` — round-table hub side
- New `consumeQueuedMessages(eventStore, tenantId, runId): Promise<string>` helper: lists events (limit 100), filters `agentId === 'user' && metadata.queuedForNextRound === true`, concatenates `content.text` values in sequence-ASC order under a single `User:` prefix, then atomically clears the flag via `jsonb_set` UPDATE. Returns empty string when nothing queued.
- `runRoundTable` outer loop: after the existing `current_round` bump, when `round > 1` call `consumeQueuedMessages` and `transcript.push(queuedBlock)` if non-empty. The transcript accumulator already drives the GROUP DISCUSSION block for round 2+ first agents.
- `runRoundTable` post-loop: `db.update(runs).set({ currentRound: null }).where(eq(id, runId))` — best-effort, wrapped in try/catch.
- PRIOR CONVERSATION block filter (Plan 17.1-07 code path) now also excludes events with `metadata.queuedForNextRound === true`. This is a Rule 1 deviation explained in Deviations below.

### `apps/web/app/api/runs/[id]/messages/route.ts` — messages route web side
- New branch at the top of `POST` (after `requireTenantContext` + body parse, BEFORE the existing attachment-resolution flow): read `runs.current_round + status` for the runId; if `currentRound !== null` then take the queue path.
- Queue path: compute `nextSeq` via `tdb.execute(sql\`SELECT COALESCE(MAX(sequence_number), 0)::int + 1 AS next_seq ...\`)`, INSERT a single events row with `type: 'agent_message'`, `agentId: 'user'`, `content: { text } | { text, attachmentIds }`, `metadata: { queuedForNextRound: true }`. Single retry on unique-violation; surface 500 if both attempts fail. SKIP `hubClient.startRun`. Return `{ ok: true, queued: true }`.
- Idle path: unchanged (runs.update status='executing' + hubClient.startRun + existing attachment fan-out).

## Tests added

| File | Tests | What it covers |
| --- | --- | --- |
| `apps/agent-hub/src/__tests__/routes-queue.test.ts` | 5 | one-msg consumption on round 2; multi-msg concat in send-order; round-1 skip (no jsonb_set fires); flag clear after consumption (db.execute called once); current_round=null on rounds-loop exit |
| `apps/web/app/api/runs/[id]/messages/route.test.ts` | 3 | queue branch when current_round != null (insert + skip startRun); idle branch when current_round IS NULL (existing path); attachmentIds preserved in queued event content |

## Verification

- `cd apps/agent-hub && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run` — clean tsc + 54/54 tests pass (10 test files including the new `routes-queue.test.ts`).
- `cd apps/web && corepack pnpm exec tsc --noEmit && corepack pnpm exec vitest run` — clean tsc + 247/248 tests pass. The single failure is the pre-existing `components/transcript/user-message-attachments.test.tsx` "renders an inline <img>" assertion (mismatch between expected `/download` and actual `/download?inline=1`), explicitly called out as out of scope in the plan brief.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] PRIOR CONVERSATION block leaked queued user events**
- **Found during:** Task 1 GREEN test runs. The "consumes one queued message at start of round 2" assertion failed because round-1's prompt unexpectedly contained the queued text — the existing PRIOR CONVERSATION block (Plan 17.1-07) lists every prior `agent_message` user event as `User: <text>`, with no awareness of the new queue flag.
- **Issue:** Without filtering, queued events show up twice on round 2 (once from PRIOR CONVERSATION via `User: <text>`, once from `consumeQueuedMessages` prepending the same text), and once on round 1 — leaking what should be future input into the round-1 prompt.
- **Fix:** Added an additional clause to the PRIOR CONVERSATION filter in `runRoundTable`:
  ```ts
  (e.metadata as Record<string, unknown> | undefined)?.queuedForNextRound !== true
  ```
  Once `consumeQueuedMessages` clears the flag (sets it to `false`), consumed-and-cleared events flow back into PRIOR CONVERSATION on the round AFTER consumption — preserving the chronological transcript on subsequent rounds.
- **Files modified:** `apps/agent-hub/src/http/routes.ts`
- **Commit:** bbe113f (Task 1 GREEN)

### Test-typing fix

The route test mocked `hubClient.startRun` with `(...args: unknown[]) => mockStartRun(...args as [any])` which tripped tsc with "Expected 0 arguments, but got 1". Tightened the typing to `(args: Record<string, unknown>) => mockStartRun(args)` and the mockStartRun signature to match. Not a behavior change — purely a test-file tsc fix.

## Known Stubs

None. Both task surfaces (queue persistence + queue consumption) are fully wired end-to-end. The only deferred concern is **queued attachments fan-out** (queued messages with attachments show in transcript with chips, but agents see only the raw text in the `User:` block — no extracted-text injection at round-start), which is documented as accepted-deferred in the plan's threat model and is a future enhancement, not a stub.

## Deferred Items

Per the plan's threat model:
- **Queued attachments fan-out into agent prompts.** Currently only the raw text reaches agents via the `User:` block; extracted text + image base64 forwarding for queued messages would require running `buildAttachmentBlock` + image-bytes fetch at round-start (in `consumeQueuedMessages` or alongside it). Listed as future enhancement.
- **Sequence-collision fix via hub-side enqueue endpoint.** Current MAX+1 with single retry has a small race with the hub's SequenceCounter. Worst case: a 500 returned to the user. Fix would be a new `/enqueue` hub endpoint that the messages route POSTs to in the queue path, letting SequenceCounter own all writes. Deferred until UAT shows the race actually fires.

## Self-Check: PASSED

Files exist:
- FOUND: `apps/agent-hub/src/__tests__/routes-queue.test.ts`
- FOUND: `apps/web/app/api/runs/[id]/messages/route.test.ts`
- FOUND: `apps/agent-hub/src/http/routes.ts` (modified)
- FOUND: `apps/web/app/api/runs/[id]/messages/route.ts` (modified)

Commits exist:
- FOUND: 55d5e83 (Task 1 RED)
- FOUND: bbe113f (Task 1 GREEN)
- FOUND: 8066205 (Task 2 RED)
- FOUND: 0f7334a (Task 2 GREEN)
