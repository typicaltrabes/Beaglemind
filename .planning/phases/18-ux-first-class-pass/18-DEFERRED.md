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
