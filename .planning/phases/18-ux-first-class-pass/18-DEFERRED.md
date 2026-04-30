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

### D-13 — Multi-round round-table (agents keep conversing)
- Surfaced 2026-04-30: in the Console, agents answer once each and the run hard-stops at `executing → completed`. In WhatsApp, the same agents have rich back-and-forth conversations — that's where Lucas gets the best outcomes.
- Root cause: `apps/agent-hub/src/http/routes.ts:242-442` — `runRoundTable` loops `['mo', 'jarvis', 'herman']` exactly once, then unconditionally writes `status: 'completed'` at line 413. No continuation logic.
- The `state_transition` notification is a symptom, not a cause. The hard stop is the for-loop exiting.
- Direction (recommended): **Option A — multi-round with stop conditions**
  - Wrap the existing per-agent loop in an outer round loop, max N rounds (default 3)
  - Stop conditions: (a) 2+ agents produce "no new substance" responses, (b) cost cap hit ($2/run default), (c) explicit "I'm done" from an agent
  - Emit `state_transition` events between rounds (`round-1 → round-2`) so the redesigned timeline (D-11) shows depth
  - PRIOR CONVERSATION block already implemented (lines 254-295) — accumulates naturally per round
- **Spike prerequisite:** the "no new substance" detector is the hard part. False positives kill conversations early; false negatives let them run forever. Spike options:
  - Embedding-similarity vs. prior turn (cosine > 0.85 → repeat)
  - Regex/heuristic on hedge phrases ("I agree", "concur", "as Mo said")
  - Cheap LLM classifier (but Lucas's no-Haiku rule means Sonnet — adds latency + cost per turn)
- Alternative directions:
  - Option B — reactive continuation (ask each agent if they want to respond → most natural but expensive)
  - Option C — user-controlled "Continue" button (cheapest, manual lever)
- This compounds with D-11: a redesigned multi-round timeline with swim lanes naturally shows the deeper conversation, which is the feature that makes this change visible.
