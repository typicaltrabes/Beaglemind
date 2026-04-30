# Phase 19: Free-flowing Conversation Substrate — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Source:** Conversation with Lucas + entry D-13 in `.planning/phases/18-ux-first-class-pass/18-DEFERRED.md`

<domain>
## Phase Boundary

Transform the Console run experience from a single `mo → jarvis → herman` pass that hard-stops at `executing → completed` into a WhatsApp-parity substrate where conversations cycle multiple rounds, runs stay live until silence, the user sees per-agent presence indicators, and follow-up messages slot naturally into the next round. **Console-only.** Agent-side cadence governance (when agents themselves stop talking) is explicitly out of scope and will be decided separately by Lucas + Henrik.

## Why this phase

Lucas's primary lever for proving the Console can replace WhatsApp is the conversation richness that emerges from multi-round flow. The current single-pass behavior makes the Console feel like a one-shot Q&A tool; WhatsApp gives the agents a shared room where they can riff. Phase 19 aligns the Console substrate with the WhatsApp behavior Lucas already trusts.

This phase is prerequisite for D-11 (timeline tab redesign) — the swim-lane visualization only has rich content to display once conversations span multiple rounds.

</domain>

<decisions>
## Implementation Decisions

### Scope (HARD LOCK)
- Console-only changes. No edits to Mo / Jarvis / Herman SOUL.md, persona prompts, or any agent-side configuration.
- No agent-side signal protocol (`[CONTINUE]`/`[DONE]` tokens, tool calls, structured outputs are all OUT OF SCOPE).
- The Console must NOT impose any cadence protocol on the agents. Each agent sees the accumulating transcript and produces a reply each turn it's offered. The substrate provides the room; agents fill it.
- Agent-side cadence (how agents themselves know when to stop talking) is decided separately by Lucas + Henrik in a future workstream.

### Multi-round orchestration
- Replace the single-pass `for (const agentId of ['mo','jarvis','herman'])` loop in `apps/agent-hub/src/http/routes.ts` with an N-round outer loop.
- Default N = 3 rounds, configurable per project (new column on the project record).
- Each round: `mo → jarvis → herman` in sequence, all seeing the full accumulating transcript.
- Inter-round pause: 1500ms by default, configurable. Lets the user read each round before the next fires.
- Emit `state_transition` events between rounds (`round-1 → round-2`, etc.) so the run timeline surfaces conversation depth.
- The PRIOR CONVERSATION block (`routes.ts:254-295`, 30-event / 80K-char cap) already handles transcript accumulation — leave intact; it naturally extends across rounds.

### Run lifecycle (silence-driven, not pass-driven)
- Remove the unconditional `status: 'completed'` write at `apps/agent-hub/src/http/routes.ts:413`.
- Remove the immediate `state_transition: executing → completed` emission tied to the pass-end (currently lines 425-433).
- Replace with an idle-timeout watcher: a BullMQ delayed job keyed by `runId`, scheduled for `IDLE_TIMEOUT_MINUTES` minutes (default 7) from the most recent event.
- Every new event (agent reply, user message, agent failure marker, presence indicator state-change) reschedules the job to fire 7 minutes from now.
- When the job fires: the orchestrator atomically (a) writes `runs.status = 'completed'` to the DB, (b) emits the `state_transition: executing → completed` event, (c) tears down any per-run watcher state.
- Run statuses: `executing` (rounds in progress OR idle pending timeout) and `completed` (timeout fired). Optional new `idle` sub-state — see UI decisions below.

### Continue affordance
- New "Continue conversation" button on the run-detail page, visible whenever the run status is `executing`.
- Clicking it triggers another N rounds against the existing transcript without requiring a user message.
- Implementation: posts an internal "continue" signal that re-enters `runRoundTable` with `userPrompt = ''` and a flag indicating "no new user input — just keep cycling". The first agent in the round sees a transcript that ends with the previous round's last reply rather than a fresh `User:` line.

### Per-agent presence indicators
- Three new event types on the SSE channel: `presence_thinking_start`, `presence_thinking_end`, `presence_typing` (the last is reserved; not all bridges support streaming).
- `sendToAgent` (CLI bridge) emits `presence_thinking_start` immediately before the SSH spawn and `presence_thinking_end` immediately after the response is parsed (or after the failure-bubble event is published).
- `sendToAgentWithVision` (Anthropic vision bridge) does the same wrap.
- Run-detail UI subscribes to these events and renders a "Mo is thinking…" / "Jarvis is thinking…" indicator inline in the transcript at the position of the next expected event. Indicator clears when the matching `presence_thinking_end` arrives or the agent's actual `agent_message` event arrives (whichever first).
- Indicator visual treatment: dim text + animated dots (CSS `@keyframes`), distinct from a real `agent_message` bubble.

### User mid-conversation message handling
- When the user posts a message via the existing composer endpoint (`POST /runs/:id/messages` or whichever endpoint the existing post-completion follow-up flow uses) AND `runRoundTable` is currently mid-loop for that runId:
  - The new message MUST NOT interrupt the current agent's in-flight call.
  - Persist the message immediately (so it shows in the transcript with normal ordering) but mark it `metadata.queuedForNextRound = true`.
  - At the start of the next round, prepend the queued user input into the `--- GROUP DISCUSSION ---` block before the next agent's call. Then clear the flag.
  - Multiple queued messages between rounds are concatenated in send-order under a single "User:" prefix.
- If the run is in idle-timeout state (rounds finished, watcher pending): treat the user message as the trigger for another N rounds. The watcher is cancelled and a new round-cycle starts.

### Live-vs-completed UI distinction
- Run-detail header: when status is `executing`, show a pulsing "live" dot + "Live" label (replace the current amber `executing` chip with a more visible WhatsApp-style "online" indicator).
- Run-history list: same "live" indicator on the list row for rows where status is `executing`. Today these rows show the amber `executing` pill — update to the live indicator.
- Once `completed`: existing green pill remains.
- Cancelled runs are unchanged.
- The `live` color must be visually distinct from the existing presence-pulse-green used on the agent roster. Recommended: pulsing accent color (the orange used for Mo brand) rather than green, so users don't conflate "the run is live" with "an agent is online."

### Configuration knobs (per-project, with defaults)
- `roundCountDefault` — INT, default 3
- `idleTimeoutMinutes` — INT, default 7
- `interRoundPauseMs` — INT, default 1500
- Surfacing UI: live in Settings page (M8 in 18-DEFERRED.md is already a planned settings expansion — this phase defers Settings UI for these knobs to a future phase; expose via DB-direct or env var only for now).

### Failure handling
- If an agent fails (CLI bridge null, Anthropic vision bridge throw): the existing failure-bubble logic at `routes.ts:379-403` continues to apply — emit a one-line failure marker `agent_message`, do NOT interrupt the round, do NOT cancel subsequent agents in the same round.
- A failure event still resets the idle-timeout watcher (it's an event).
- If ALL three agents fail in a single round: the round still counts toward N, the loop continues, but log a warning. Phase 19 does NOT introduce a new "all failed" early-stop — that's a separate concern.

### Data model changes
- New columns on the `runs` table OR new project-scoped config table — planner's choice:
  - `round_count` INT NOT NULL DEFAULT 3
  - `idle_timeout_minutes` INT NOT NULL DEFAULT 7
  - `inter_round_pause_ms` INT NOT NULL DEFAULT 1500
- New columns on the `runs` table:
  - `last_event_at` TIMESTAMP — updated on every event publish, used by the watcher to decide whether to reschedule.
  - `current_round` INT — null until round 1 starts, increments per round, useful for UI debugging.
- BullMQ queue: new `idle-timeout` queue, delayed jobs keyed by `${tenantId}:${runId}`.

### Claude's Discretion
- Exact BullMQ vs. Postgres-poll-loop choice for the idle-timeout watcher. Both are workable; planner should pick based on existing infra patterns and explain.
- DB schema location: project-scoped config vs. per-run snapshot. Planner picks; per-run snapshot may be cleaner because changing project defaults shouldn't retroactively change idle-timeout for in-flight runs.
- Whether the "Continue" button shows during a still-cycling round (gray-out) or only between rounds (visible only after the third reply lands).
- CSS/component reuse for the live indicator — match existing design tokens.
- Whether to add a new `idle` enum value to the run status, or treat `executing` as a superset spanning "rounds in progress" and "rounds done waiting for timeout." Recommend: keep `executing` as the only non-terminal state; the UI distinguishes via `current_round`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current orchestrator
- `apps/agent-hub/src/http/routes.ts` — `runRoundTable()` at lines 242-442 is the function being modified. Lines 197-220 handle the existing post-completion follow-up flow that the Continue affordance will reuse. The unconditional `status: 'completed'` write is at line 413.

### Bridges (preserve, wrap with presence emissions)
- `apps/agent-hub/src/connections/openclaw-cli-bridge.ts` — `sendToAgent` (text-only path)
- `apps/agent-hub/src/connections/anthropic-vision-bridge.ts` — `sendToAgentWithVision` (image-bearing path)

### Event store + SSE pipeline
- `apps/agent-hub/src/events/event-store.ts` — `EventStore` (used for transcript persistence + replay)
- `apps/agent-hub/src/notifications/` — message router for SSE broadcast
- Phase 3 (Agent Connection Hub) Redis pub/sub channel + Phase 5 (Transcript UI) SSE consumer in `apps/web/`

### Worker queue
- `apps/worker/` — existing BullMQ worker, target for the new idle-timeout queue

### DB schema
- `packages/db/src/schema/` — Drizzle ORM schemas. Tenant schema isolation per `apps/web/lib/get-tenant.ts`.

### UI surfaces touched
- `apps/web/app/projects/[projectId]/runs/[runId]/` — run-detail page (Continue button + presence indicators + live header)
- `apps/web/app/runs/` — run-history list (live indicator on rows)
- Status pill component (single source of truth for the `executing` chip — find it via grep)

### Project memory
- `~/.claude/projects/-Users-lucastraber/memory/project_beagle_console.md` — "Conversation cadence philosophy (decided 2026-04-30)" section captures scope decisions and division of responsibility. Read first to avoid scope creep into agent-side work.

### Deferred queue
- `.planning/phases/18-ux-first-class-pass/18-DEFERRED.md` — entry D-13 has the original problem statement and decision log

### Roadmap
- `.planning/ROADMAP.md` — Phase 19 entry has the 7 success criteria

</canonical_refs>

<specifics>
## Specific Ideas

- The "Continue conversation" button label and treatment should match Lucas's preference for terse, direct UI. Possibilities: "Continue", "Keep going", "Another round". The button is also a lever for explicit user control over cadence — important for the proof-of-product moment.
- "Live" indicator visual: take inspiration from WhatsApp's "online" green dot and Slack's "in conversation" indicators. Pulsing rather than static.
- Presence indicator placement: inline in the transcript at the bottom (where the next event will appear), not in the run header. Matches WhatsApp where the "typing…" indicator appears in the chat itself.
- The inter-round pause (1500ms) gives the user a moment to read. Should be skippable with a "skip" button or by sending a new message — but that's polish, not core phase.

## Test scenarios (for UAT)

1. Cold start: post a fresh prompt → observe 3 full rounds of mo → jarvis → herman → run stays in `executing` (live indicator visible) → wait 7 min → run flips to `completed`.
2. Continue: same as #1 but click "Continue" before the 7-min timeout → another 3 rounds run → idle timer resets.
3. Mid-conversation message: post a prompt → during round 2 (while Jarvis is mid-reply), post another message → confirm Jarvis's reply lands first, then the new user message appears, then the next round picks it up in the GROUP DISCUSSION block.
4. Vision pass-through still works: post a prompt with an image → all three agents see it on round 1; on rounds 2-3 they see prior responses (as text) but NOT the image (existing single-image-per-prompt semantics — leave alone unless trivial to fix).
5. Failure during a round: if Mo's CLI bridge fails, the failure marker appears, Jarvis still runs in that round, Herman still runs, the round still counts toward N.
6. Idle timer exact: trigger one round, wait until 7 min after the last agent reply, run completes within ±5 sec of the 7-min mark.
7. Two queued messages between rounds: post message A during round 2, post message B between rounds 2 and 3 → at start of round 3, both A and B appear concatenated as a single "User:" entry in the GROUP DISCUSSION block.

</specifics>

<deferred>
## Deferred Ideas

- Settings-page UI for the three configuration knobs (roundCountDefault, idleTimeoutMinutes, interRoundPauseMs). Expose via DB direct or env var for now. Settings page expansion is its own phase (D-01 in 18-DEFERRED.md).
- "Skip pause" affordance for the 1500ms inter-round delay.
- Vision pass-through across rounds (currently image only available to round-1 agents). If trivial to fix, planner may include — otherwise defer.
- Mobile-specific UX for live indicators / Continue button. Desktop only this phase; mobile inherits whatever lands.
- Cancel-from-mid-round (force stop the cycling). Use existing `POST /runs/stop` if it works; if it doesn't gracefully stop a mid-loop runRoundTable, that's a known gap left for a future phase.
- Resumption after server restart. If agent-hub container restarts mid-loop, the round-cycling is lost (in-memory). The PRIOR CONVERSATION block ensures the next user message recovers context, but mid-loop continuation is not preserved. Acceptable for v1.
- BullMQ job persistence across worker restarts — should already be on by default but verify; if not, the watcher needs Redis-backed state.

</deferred>

---

*Phase: 19-free-flowing-conversation*
*Context gathered: 2026-04-30 from conversation + D-13 deferred entry*
