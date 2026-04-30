# 18-DEFERRED — items intentionally not in Phase 18

These were surfaced by the 2026-04-29 UX walkthrough but pushed out of Phase 18 to preserve the 3-hour budget. Each entry is enough context to plan from cold in a future phase.

## Deferred plans (in priority order for next pass)

### D-01 — Settings expansion (M8 + M9)
- Auto-save with no toast — add `Saved ✓` confirmation on dropdown change
- Add: name, email, organization (currently in Hanseatic but invisible), keyboard shortcuts help, data export, delete account
- Settings page is sparse compared to expectations for a paid product

### D-02 — Theme cleanup (M13)
- Theme dropdown shows Dark / Auto. "Auto" can resolve to Light, but Light theme is broken (Phase 13-05 reverted `:root` to light tokens but never QA'd).
- Either: (a) fix Light theme properly, or (b) drop Auto until Light works.
- **Decision needed first** — surfaced in deferred list so Lucas can choose.

### D-03 — Executive Summary export (L6)
- Lucas's external-feedback memo flagged this as headline product differentiation
- Current: zero export options (no PDF, no markdown, no JSON)
- Build: per-run "Export as Executive Summary" → uses an LLM pass (Sonnet/Opus) to summarize round-table outcome with structured headers (Decision / Disagreement / Open Questions / Cost)
- Format options: PDF (rendered server-side), Markdown, structured JSON

### D-04 — Empty-state CTAs + Cancelled cleanup (L3 + L4)
- Empty Shared Links page should link to "Open a completed run and click Share replay"
- 25+ cancelled debug runs polluting the run list — add bulk-delete or auto-archive after N days
- /runs filter `cancelled` chip exists but no cleanup action

### D-05 — Favorites / pin runs (L5)
- 30+ runs in list, finding "the one with the Trilantic statement" is scroll-only
- Add star icon on run row → pinned section at top of list

### D-06 — Keyboard shortcuts + scroll affordances (L1 + L2)
- 1/2/3/4 → tab switching
- C → toggle Clean/Studio
- ⌘↩ → send
- / → focus composer
- "Scroll to top" / "Jump to first message" floating button on long runs

### D-07 — Fork/Branch implementation (L8)
- Studio Process panel has empty Fork/Branch section
- Either implement ("what if Mo had said yes" branching) or remove the section
- Lucas's call on whether this is a real feature or vestigial UI

### D-08 — Agent role tooltips (L7)
- Senior Partner / Analyst Extraordinaire / Resident Contrarian / Sentinel — evocative but unexplained
- Hover on agent name → one-sentence role description
- Source roles from the same persona-loader cache used for vision

### D-09 — Light theme proper QA pass
- If D-02 chooses (a), this is the actual work: walk through every component in light mode
- Surface bugs, fix tokens, snapshot test for visual regression

### D-10 — Settings org + member management
- Currently no UI to invite teammates, see org members, set roles
- Better Auth Organization plugin already supports this — needs UI

### D-11 — Timeline tab redesign (desktop)
- Surfaced 2026-04-30 Playwright walkthrough of UAT-17.1 round-3 run
- Current state: single horizontal track of 12px dots + Play/scrubber/1×/2×/4×. Issues:
  - Bottom ~380px of tab is dead space (no detail panel synced to scrubber)
  - Dots overlap silently when events cluster (10 events, only ~7 visible)
  - No time axis ticks, no agent legend, no labels
  - Color encodes both agent identity and event type — collision
  - Play/scrubber is video-player UI on data that's actually a structured event log
- Direction (decided): Option A swim-lane layout for desktop
  - One row per agent (Mo / Jarvis / Herman / You / system) with name on left
  - Time axis along the top with mm:ss tick marks
  - Dots become labeled pills with truncated message preview
  - Bottom half of tab = selected-event detail panel (sender, full text, cost, latency, attachments)
  - Drop Play/scrubber + 1×/2×/4× — solving a problem the data doesn't have
- Mobile is explicitly out of scope — wireframe-only for now
- Sketch lives in: .planning/sketches/ (TBD by /gsd-sketch run)

### D-12 — Sticky sidebar on long run scroll
- When scrolling through a long run's transcript, the left sidebar (Agents list + Projects + Run History / Shared Links / Questions footer nav) scrolls away
- Should be `position: sticky` or `position: fixed` so agent presence + project nav are always reachable
- Affects /runs, /runs/[id], /projects/[id] — anywhere the main content can exceed viewport height
- Likely a one-line fix in the sidebar wrapper component but verify on mobile (sidebar is drawer on mobile, must not double-fix)

### D-13 — Console substrate for free-flowing conversation (console-only)
- Surfaced 2026-04-30: in the Console, agents answer once each and the run hard-stops at `executing → completed`. In WhatsApp, the same agents have rich back-and-forth conversations — that's where Lucas gets the best outcomes.
- Root cause: `apps/agent-hub/src/http/routes.ts:242-442` — `runRoundTable` loops `['mo', 'jarvis', 'herman']` exactly once, then unconditionally writes `status: 'completed'` at line 413. No continuation logic.

#### SCOPE BOUNDARY (decided 2026-04-30, hard line)
**This phase is console-only.** No agent-side changes. Lucas + Henrik will decide separately how agents naturally regulate their own cadence (when to stop talking, when to push, etc.). The console's job is to provide a chat substrate that doesn't impose any protocol or limit on the agents — same as WhatsApp gives them.

Anything that requires editing Mo / Jarvis / Herman SOUL.md, adding tokens to agent prompts (`[CONTINUE]`/`[DONE]`), or asking agents to follow a console-specific protocol = OUT OF SCOPE. Earlier drafts of this entry proposed those — they were misscoped and have been removed.

#### Console-only changes

1. **Drop the auto-complete write.** Remove the unconditional `status: 'completed'` at `routes.ts:413`. Runs stay `executing` until the idle-timeout watcher fires.
2. **Multi-round auto-cycle.** Change the round-table from one pass to N passes (default N=3, configurable per project). Each round = `mo → jarvis → herman`, all seeing the full accumulating transcript via the existing PRIOR CONVERSATION block (lines 254-295). After N auto-rounds, the run stays open but stops auto-cycling.
3. **"Continue conversation" affordance.** A button in the run-detail UI that triggers another N rounds without needing a new user prompt. Lets Lucas drive cadence on top of auto-cycling.
4. **Idle-timeout watcher.** Background job (BullMQ delayed job preferred over Postgres poll) keyed on run id. After 7 min (configurable) of total silence — no user message, no agent event — emit `state_transition: executing → completed`. Every new event resets the timer.
5. **Live presence indicators.** "Mo is thinking…" / "Jarvis is typing…" per-agent, broadcast over the same SSE channel as transcript events. Mirrors WhatsApp UX so waits read as intentional. Indicators show during a turn's generation and between auto-rounds.
6. **User mid-conversation message handling.** Queue the message, inject at start of next round inside `--- GROUP DISCUSSION ---`. Never interrupt a mid-agent turn.
7. **Visual distinction for live runs.** UI must clearly show "live / still going" vs. "completed" so Lucas knows when he can keep typing without re-booting a fresh run.

#### Compounds with
- **D-11** (timeline redesign): multi-round conversations are exactly what the swim-lane design is meant to surface. Without D-13, D-11 has nothing rich to display.
- **D-12** (sticky sidebar): long flowing conversations mean lots of scroll; agent presence dots must stay visible the entire time so Lucas can see who's about to speak.

#### Open implementation questions
- Round count default: 3 too low? 5 too noisy? Validate by trying it once shipped.
- "Continue" button placement: footer next to composer, or floating action button?
- Should the auto-cycle pause briefly between rounds (1-2s) so the user can read each round's output before the next starts firing?
