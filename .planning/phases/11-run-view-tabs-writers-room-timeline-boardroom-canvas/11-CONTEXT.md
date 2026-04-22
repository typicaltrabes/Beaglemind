# Phase 11: Run-view tabs (Writers' Room, Timeline, Boardroom, Canvas) — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** Fast-path from user briefing (no discuss-phase, no research)

<domain>
## Phase Boundary

Ship a four-tab switcher on the run view page that lets the user view the same run through four lenses:
1. **Writers' Room** — existing transcript (unchanged; wrapped as tab content)
2. **Timeline** — horizontal, scrubbable replay of the run indexed by event sequence/timestamp
3. **Boardroom** — parallel agent columns (one per distinct `agentId`), each showing that agent's messages
4. **Canvas** — artifact-first document surface with agent messages rendered as margin comments near the artifact they reference (or near in sequence)

All four tabs read from the existing `useRunStore` state only. No new SSE events. No hub changes. No new API routes. No new DB tables. No new store fields except ephemeral UI state (e.g., selected timeline index, selected artifact on Canvas).

**What this phase does NOT do:**
- No agent annotation system (Canvas margin comments are pure positional/proximity-based)
- No backend changes (hub, API routes, DB)
- No new event types or metadata conventions
- No cross-run comparison
- No red-team or fork hooks
- No mobile-specific redesign (tabs must be reasonable on mobile but phone-first layouts are out of scope; keep existing mobile transcript drawer behavior)

</domain>

<decisions>
## Implementation Decisions

### Tab switcher placement and pattern
- **Location:** Inside the run page at `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx`, between the existing header row (status badge + run id + Share/Stop buttons) and the content area.
- **Pattern:** Use shadcn/ui `Tabs` primitive (already in the project under `apps/web/components/ui/`; if not present as `tabs.tsx`, add it — it is a standard shadcn component built on `@radix-ui/react-tabs`).
- **Tab values:** `writers-room` | `timeline` | `boardroom` | `canvas`
- **Default tab:** `writers-room`
- **State:** URL query param `?view=<tab>` so tabs are shareable/reloadable. Fall back to `writers-room` if absent or invalid. Use `useSearchParams` + `router.replace` (shallow, no scroll reset).
- **Persistence:** No localStorage — URL is source of truth. Going to a different run resets to default.

### Writers' Room tab
- **Content:** Render existing `TldrBanner` + `MessageList` unchanged. Just wrap them in the Tabs content slot.
- **No code changes to `MessageList`, `AgentMessage`, `PlanCard`, `QuestionCard`, `ArtifactCard`, `SceneDivider`, `CollapseFold`, or `Composer`.**
- **Composer remains visible below the tab content in all tabs** — it belongs to the run, not to a specific view. User can send messages while inspecting Timeline/Boardroom/Canvas.

### Timeline view (VIEW-01)
- **Data source:** `useRunStore` — use `eventOrder` + `events` directly.
- **Layout:** Full-width horizontal lane. X-axis is time (event `timestamp` → proportional offset). Each event renders as a small colored dot/pill. Scene boundaries render as vertical divider lines with scene name labels.
- **Agent color map:** Reuse existing convention — Mo=amber-500, Jarvis=teal-500, user=blue-400, unknown=gray-500. If there is no central color map helper, create `apps/web/lib/agent-colors.ts` exporting `getAgentColor(agentId: string): string` so Timeline and Boardroom share it. Also extract this helper from `AgentMessage` if it currently inlines the map.
- **Interaction:**
  - Hover a dot → tooltip with `agentId`, event `type`, first 80 chars of content (if text).
  - Click a dot → show a detail panel below the timeline showing the full event rendered using the SAME renderers as `MessageList` (`AgentMessage`, `PlanCard`, `QuestionCard`, `ArtifactCard`). Select exactly one event at a time; click another dot to swap; click the same dot (or a Close button) to collapse the panel.
  - Scrub slider below the timeline: dragging the slider moves a playhead; the detail panel auto-follows the playhead to the nearest event by sequence.
- **Empty state:** If `eventOrder.length === 0`, show "Run has not started yet" centered.
- **Scrollability:** If total timeline width exceeds container, allow horizontal scroll. Default x-scale auto-fits the viewport when events span > 60 seconds; shorter runs pack events with generous spacing.
- **Studio vs Clean mode:** In Clean mode, hide `sentinel_flag` events and `state_transition` events. In Studio mode, show everything. No mode toggle inside the tab — use the global `useMode()`.

### Boardroom view (VIEW-02)
- **Data source:** `useRunStore` — `messages` (already TLDR-stripped by `deriveState`) grouped by `agentId`.
- **Layout:** CSS grid with one column per distinct agent seen in `messages`, minimum column width 280px, equal widths by default, full height of the tab content area.
- **Column header:** Agent name/id with agent color swatch (reuse `agent-colors.ts`).
- **Column content:** Events belonging to that agent, sorted by `sequenceNumber` ascending, rendered using the same renderers as Writers' Room (`AgentMessage`, `PlanCard`, `QuestionCard`, `ArtifactCard`). Include `state_transition` events in ALL columns (they are run-level, not agent-level) only in Studio mode. In Clean mode, drop `state_transition` entirely in Boardroom.
- **User column:** `agentId === 'user'` becomes one of the columns; no special casing beyond the color.
- **Empty state:** If 0 agents, show "No agent activity yet".
- **Mobile:** On viewport < 768px, collapse columns to a single-column accordion with agent name as section header. Do not try to fit multiple columns on a phone.
- **Scroll behavior:** Each column scrolls independently (overflow-y-auto). No auto-scroll-to-bottom in Boardroom — user pins their attention manually.

### Canvas view (VIEW-03)
- **Data source:** `useRunStore` — `artifacts` array, plus `messages` filtered for agent commentary.
- **Layout:** Two-pane responsive split. Left pane (≥768px: 70% width, <768px: full width): selected artifact preview. Right pane (≥768px: 30% width, <768px: collapses to section below preview): margin comments.
- **Artifact selector:** If >1 artifact, show a tabs or pill strip at the top of the Canvas view for switching between them. If 1 artifact, auto-select it. If 0 artifacts, show empty state "No artifacts delivered yet — Canvas will populate as agents produce outputs".
- **Artifact preview rendering:**
  - For `mimeType` in `PREVIEWABLE_MIMES` (pdf, docx — already defined in `artifact-card.tsx`), reuse `ArtifactPreviewPanel` inline (not in a dialog).
  - For non-previewable types, show the artifact metadata card (filename, size) with a "Download" link only — no inline preview.
- **Margin comments (proximity-based, no annotation system):**
  - Define a "comment window" as: the currently-selected artifact event plus the 5 `agent_message` events that come closest to it by `sequenceNumber` (up to 3 before, up to 3 after — clamp to total of 5 closest).
  - Render each as a compact variant of `AgentMessage` (same colors, smaller text, no scene grouping). Label each with relative position: "before", "at", "after".
  - This is explicitly proximity-based, not semantic — do NOT try to parse message text for artifact references.
- **Studio vs Clean:** No mode-specific behavior on Canvas beyond what the underlying renderers do (agent messages already respect Clean/Studio in their own components if applicable).

### Shared renderer helper
- Extract a small helper from `MessageList.tsx`'s `renderSingleEvent` into `apps/web/components/transcript/render-event.tsx` (exported `renderEvent(event, runId)`), so Timeline (detail panel) and Boardroom (column items) can reuse it without duplicating the switch statement.
- `MessageList.tsx` should import this helper instead of having an inline copy. This is a small refactor — not a behavior change.

### URL + shared-link behavior
- `?view=<tab>` works on the normal run page.
- **Replay/shared-link page (`/replay/[token]`) is OUT OF SCOPE for this phase.** Per REPL-04 only Writers' Room is exposed externally. Do NOT add tabs to the replay page. If the planner is tempted to touch `apps/web/app/replay/`, skip it.

### Testing
- No new integration tests required this phase (no backend changes).
- Add unit tests for any pure helpers created: `agent-colors.ts` (`getAgentColor`) and any proximity/grouping pure functions.
- Manual UAT: user will test on console.beaglemind.ai after deploy.

### Deploy
- Use existing manual deploy workflow: push to GitHub → SSH `beaglehq` → `cd /tmp/beagle-build && sudo git pull origin main` → `sudo docker build -t ghcr.io/typicaltrabes/console-web:latest -f apps/web/Dockerfile .` → `cd /opt/beagle-console && sudo docker compose up -d --force-recreate console-web`.
- Single deploy at the end of the phase; do not deploy per-plan.

### Claude's Discretion
- Exact Timeline dot sizing, hover tooltip styling, detail panel height.
- Exact Boardroom column header styling beyond "agent name + color swatch".
- Exact artifact selector UI (pills vs. secondary tabs bar) — pick whichever reads cleaner.
- Whether to memoize derived arrays via `useMemo`.
- File naming within `apps/web/components/` for new tab components (suggestion: `components/run-views/timeline-view.tsx`, `boardroom-view.tsx`, `canvas-view.tsx`, plus `run-view-tabs.tsx` for the switcher).
- Whether to add a Tabs primitive at `components/ui/tabs.tsx` if missing (expected — shadcn has not been added yet based on existing `components/ui/` inventory).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Run view entry point
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — current run page; this is where the tab switcher is inserted.

### Existing transcript components (reuse, do not modify)
- `apps/web/components/transcript/message-list.tsx` — Writers' Room list; extract `renderSingleEvent` into a shared helper.
- `apps/web/components/transcript/agent-message.tsx` — agent message bubble.
- `apps/web/components/transcript/plan-card.tsx`
- `apps/web/components/transcript/question-card.tsx`
- `apps/web/components/transcript/artifact-card.tsx` — reuse its `PREVIEWABLE_MIMES` const in Canvas.
- `apps/web/components/transcript/artifact-preview-panel.tsx` — reuse inline on Canvas.
- `apps/web/components/transcript/scene-divider.tsx`
- `apps/web/components/transcript/collapse-fold.tsx`
- `apps/web/components/transcript/tldr-banner.tsx`
- `apps/web/components/transcript/composer.tsx` — remains below tab content, unchanged.

### State
- `apps/web/lib/stores/run-store.ts` — `useRunStore` state shape and derived arrays. **Read this before planning data access.**
- `apps/web/lib/mode-context.tsx` — `useMode()` returning `'clean' | 'studio'`.
- `packages/shared/src/hub-events.ts` — `HubEventEnvelope`, `MessageType` enum (includes `sentinel_flag`, `state_transition`).

### UI primitives
- `apps/web/components/ui/` — existing shadcn primitives in this project. Add `tabs.tsx` here if missing.

### Mode/role conventions
- `.planning/REQUIREMENTS.md` — VIEW-01, VIEW-02, VIEW-03, TRAN-07 (Writers' Room as primary), REPL-04 (external viewers see Writers' Room only).

</canonical_refs>

<specifics>
## Specific Ideas

- Sequence number is the authoritative ordering key inside run-store; timestamps may be close in time for parallel agent messages — for Timeline positioning, use timestamps for X-coordinates but sequence for tie-breaking and for the scrubber.
- `metadata.sceneId` / `metadata.sceneName` already populated on events where present — `scenes` array in run-store is derived. Use it for Timeline scene dividers.
- `tldr_update` events are already filtered out of `messages` by `deriveState`. Keep that property — do not re-introduce TLDR events in any tab's event list.
- Deduping: run-store already dedupes by sequence; tabs don't need their own dedup.
- `agentId === 'user'` distinguishes user-sent events from agent events. Treat user as "just another column" in Boardroom.
- In Clean mode, `sentinel_flag` events are the primary thing to hide. `state_transition` is also noise in Clean mode.

</specifics>

<deferred>
## Deferred Ideas

- Annotation system where agents explicitly tag artifact-reference points (would enable true Canvas margin comments tied to document positions).
- Playback mode on Timeline (auto-advance playhead at configurable speed).
- Collapsing multiple back-to-back events from the same agent on Timeline.
- Boardroom column resize / reorder / pin.
- Canvas diff view between artifact versions.
- Multi-artifact side-by-side on Canvas.
- Tabs on the replay/shared-link page (explicitly out of scope per REPL-04).
- Mobile-first redesign of Timeline/Boardroom (this phase only does reasonable responsive fallbacks).

</deferred>

---

*Phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas*
*Context gathered: 2026-04-22 via fast-path from user briefing*
