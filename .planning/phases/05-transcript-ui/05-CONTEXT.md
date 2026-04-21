# Phase 5: Transcript UI - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the basic message list (Phase 4) into the full Writers' Room transcript: scene detection and auto-naming, scene collapse for Clean mode, live TLDR banner, virtualized rendering for long transcripts, and proper agent visual identity with color-coded avatars.

This phase transforms the raw event stream into the "observable reasoning" experience described in the wireframes. It does NOT add Clean/Studio mode toggle (Phase 6) — it builds the transcript rendering that both modes will use.

</domain>

<decisions>
## Implementation Decisions

### Scene Detection
- **D-01:** Scene boundaries detected from event metadata. Mo includes `sceneId` and `sceneName` fields in event metadata when a new scene starts. Hub passes these through unchanged.
- **D-02:** Frontend groups events by `sceneId`. Scene dividers rendered between groups with the scene name and decorative lines (matching wireframe scene headers).
- **D-03:** Fallback: if an event has no `sceneId`, it belongs to the current (most recent) scene. If no scenes exist yet, all events are "unscened."
- **D-04:** Scene auto-naming: Mo provides names. If `sceneName` is missing but `sceneId` is present, derive name from the first agent message in that scene (first 50 chars).

### Scene Collapse (Clean Mode Default)
- **D-05:** Inter-agent exchanges of >3 consecutive messages (no user messages, no plan/question/artifact events between them) collapse into a fold: "X and Y exchanged N messages" with an expand arrow.
- **D-06:** Collapsed fold shows agent names involved, message count, and time span. Clicking expands to show all messages.
- **D-07:** User messages, plan_proposal cards, question cards, artifact cards, and state_transition events NEVER collapse.
- **D-08:** Default state is collapsed (Clean mode behavior). Phase 6 will add Studio mode where scenes are expanded by default.

### Live TLDR Banner
- **D-09:** Mo sends `tldr_update` events (new message type) with a `summary` field in content. These are NOT rendered as messages — they update a sticky banner at the top of the transcript.
- **D-10:** Banner design: blue/teal background (#12283a border #1d4a6e per wireframe), "Where we are" label in small caps, summary text below. Always visible at top of transcript area.
- **D-11:** If no TLDR events received yet, banner is hidden. First TLDR event makes it appear.

### Virtualized Rendering
- **D-12:** Use react-virtuoso for windowed rendering of the message list. Replace the current simple map-based MessageList from Phase 4.
- **D-13:** 500-message visible window. Older messages paginate on scroll-up (load from events table via API).
- **D-14:** Auto-scroll to bottom when new events arrive, unless user has scrolled up (reading history).

### Agent Visual Identity
- **D-15:** Agent avatar: 32px circle with first initial, color-coded background. Mo=gold (#f7b733, text #1a1200), Jarvis=teal (#4db6ac, text #062822), Sentinel=purple (#c86bff, text #2b0748), User=blue (#6ea8fe, text #07162b).
- **D-16:** Agent name rendered next to avatar in matching color. Role label in dim text after name (e.g. "Mo · workflow lead").
- **D-17:** Timestamp in dimmer text (#6b7389) after agent name.

### Writers' Room as Primary View
- **D-18:** The upgraded transcript IS the Writers' Room view (TRAN-07). No separate view component — the transcript area in the run page becomes the Writers' Room.

### Claude's Discretion
- react-virtuoso exact configuration (overscan, follow output settings)
- Scene divider animation/transition
- Collapse/expand animation
- TLDR banner update animation
- Scroll behavior fine-tuning
- Message timestamp format (relative vs absolute)

</decisions>

<canonical_refs>
## Canonical References

### Wireframes
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260415 Frontend Wireframes.html` — Clean mode transcript: scene headers, collapse folds, TLDR banner, agent avatars, message bubbles

### Design Document
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260417 Beagle Agent Console — Design Doc v3.md` — §7.1 Clean mode, §7.2 Writers' Room view

### Existing Code
- `apps/web/components/transcript/message-list.tsx` — Current basic list (replace with virtuoso)
- `apps/web/components/transcript/plan-card.tsx` — Plan card (keep, integrate into scene structure)
- `apps/web/components/transcript/question-card.tsx` — Question card (keep)
- `apps/web/components/transcript/artifact-card.tsx` — Artifact card (keep)
- `apps/web/components/transcript/composer.tsx` — Composer (keep)
- `apps/web/lib/stores/run-store.ts` — Zustand event store (extend with scene grouping)
- `packages/shared/src/hub-events.ts` — Event types (add tldr_update, scene metadata)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- MessageList, PlanCard, QuestionCard, ArtifactCard, Composer (Phase 4)
- Zustand run-store with normalized events
- SSE hook connecting EventSource to store
- Agent color constants likely need extraction to a shared config

### Established Patterns
- Event-driven rendering from Zustand store
- Card components for special event types
- Dark theme with CSS variables

### Integration Points
- MessageList replacement with react-virtuoso
- Zustand store needs scene grouping derived state
- Hub event types need tldr_update and scene metadata fields
- Run page integrates the upgraded transcript

</code_context>

<specifics>
## Specific Ideas

- The scene header should look exactly like the wireframe: horizontal lines on both sides of the scene name, uppercase, small letter-spacing
- The "Jarvis and Mo exchanged 11 messages" collapse fold should have a dashed border, dim text, and expand arrow on the right (per wireframe)
- The TLDR banner should feel like a status card, not a notification — always present, quietly updating

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-transcript-ui*
*Context gathered: 2026-04-21*
