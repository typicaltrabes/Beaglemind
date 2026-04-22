---
phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
plan: 04
subsystem: ui

tags:
  - canvas
  - artifact-preview
  - proximity-comments
  - run-view
  - inline-preview
  - pill-selector

# Dependency graph
requires:
  - phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas
    provides: Tabs primitive, getAgentColor, RunViewTabs placeholder panel with data-testid="run-view-canvas"
  - phase: 07-artifacts-run-history
    provides: ArtifactPreviewPanel (dialog + fetch logic), /api/artifacts/:id/preview endpoint, /api/artifacts/:id/download endpoint
  - phase: 05-transcript-ui
    provides: artifact-card.tsx hosting PREVIEWABLE_MIMES, AGENT_CONFIG display names

provides:
  - CanvasView component (components/run-views/canvas-view.tsx)
  - canvas-utils pure helper (lib/canvas-utils.ts) — selectProximityComments + ProximityComment type
  - 9 vitest assertions covering empty input, no-agent-message filtering, non-agent-message ignoring in proximity window, windowSize clamping (default 5), fewer-than-windowSize cases, sort-by-seq output invariant, proximity ordering, position labels (before/at/after), tie-break-to-lower-seq
  - Shared PREVIEWABLE_MIMES export from artifact-card.tsx (single source of truth for pdf+docx mime allowlist)
  - ArtifactPreviewInline export from artifact-preview-panel.tsx (Dialog-free reusable body)
  - ArtifactPreviewPanel refactored to compose ArtifactPreviewInline internally (behavior-preserving — fetch still gated by `open`)
  - Canvas TabsPanel wired: placeholder replaced with <CanvasView runId={runId} />

affects:
  - 11-05-PLAN (deploy + UAT — Canvas ready for manual check on completed runs with PDF/DOCX artifacts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Inline/Dialog preview split: ArtifactPreviewInline owns the fetch+render body; ArtifactPreviewPanel wraps it in Dialog chrome and gates the mount with `{open && <ArtifactPreviewInline/>}` to preserve fetch-on-open semantics'
    - 'Proximity-based (not semantic) margin comments: selectProximityComments filters to agent_message events only, sorts by absolute distance in sequenceNumber with tie-break to lower seq, returns output sorted ascending by seq'
    - 'Responsive two-pane via tailwind only (md:flex-row) — no JS media query, no matchMedia hook, no hydration mismatch risk'
    - 'Pill-strip selector for >1 artifact runs; 1 artifact auto-selects with no chrome; 0 artifacts shows dedicated empty state'
    - 'Self-healing selection: useEffect re-points selectedArtifactId to artifacts[0] if the current selection disappears from the store (defensive against stale selection during run updates)'
    - 'Single source of truth for previewable mimes: artifact-card.tsx exports PREVIEWABLE_MIMES; Canvas and artifact-card consume the same Set rather than duplicating the literal'

key-files:
  created:
    - apps/web/lib/canvas-utils.ts
    - apps/web/lib/canvas-utils.test.ts
    - apps/web/components/run-views/canvas-view.tsx
  modified:
    - apps/web/components/transcript/artifact-card.tsx
    - apps/web/components/transcript/artifact-preview-panel.tsx
    - apps/web/components/run-views/run-view-tabs.tsx

key-decisions:
  - "Inline component extraction in same file: ArtifactPreviewInline and ArtifactPreviewPanel both live in artifact-preview-panel.tsx rather than splitting into two files — the two exports share a PreviewData union type and state shape, and splitting would force re-exporting the private type. Co-location keeps the dialog and inline paths side-by-side so future changes to the fetch body touch one file."
  - "ArtifactPreviewPanel gates its inner <ArtifactPreviewInline/> with `{open && ...}` — previously the component short-circuited fetch inside its own useEffect when !open. Rewiring to the inline child means the child's useEffect always fires on mount, so the dialog path must unmount the child when closed to preserve the prior fetch-on-open behavior. Both tests and manual reasoning confirm this is behavior-preserving."
  - "Proximity tie-break to the LOWER sequenceNumber (matching the plan spec) — this is deterministic but also semantically natural: earlier context often sets up later artifacts, so 'before' events are slightly preferred when distances are equal."
  - "CanvasView owns its own selection state via useState; artifacts[0] is the default and a useEffect re-points to artifacts[0] if the selected id disappears from the store. No URL-sync for artifact selection — URL state is reserved for the tab switcher (?view=canvas); per-artifact selection is ephemeral per the CONTEXT.md decision to keep only ?view= in the URL."
  - "flex-[7] + flex-[3] over md:w-[70%] + md:w-[30%]: tailwind's flex-[N] sets both grow and basis in one class, making the 70/30 ratio explicit at the two places that matter (preview + rail). On mobile (flex-col), flex-[7]/flex-[3] collapse to stacked blocks because the parent switches to column."
  - "160-char text preview (not 80) on margin comments: the comment rail is vertical and not cramped like a hover tooltip, so a longer preview is legible. 160 chars ≈ 2 lines at the rail's font size."
  - "Proximity-only comment selection is a deliberate non-feature: the plan spec explicitly forbids parsing message text for artifact references. This matches the Phase 11 CONTEXT.md decision to defer any real annotation system and keep Canvas positional."

patterns-established:
  - "canvas-utils as a third sibling of timeline-utils and boardroom-utils — per-view pure helpers live in lib/ with colocated vitest, zero React imports"
  - "Extraction pattern for reusable UI bodies: keep the existing Dialog variant, introduce an Inline variant exporting the same body with h-full w-full, refactor the Dialog to compose the Inline child — two-step, behavior-preserving, lets a new consumer mount the body without Dialog chrome"
  - "ArtifactContent type cast at the CanvasView boundary: HubEventEnvelope.content is Record<string, unknown>; Canvas narrows it to a local ArtifactContent alias at the component boundary so downstream reads are typed"

requirements-completed:
  - VIEW-03

# Metrics
duration: 4min
completed: 2026-04-22
---

# Phase 11 Plan 04: Canvas View Summary

**VIEW-03 Canvas tab: artifact-first document surface with inline PDF/DOCX preview (shared with the dialog variant), pill-strip multi-artifact selector, and a proximity-based 5-message margin comment rail labeled before/at/after — all client-side over existing useRunStore state.**

## Performance

- **Duration:** ~4 min (216s)
- **Started:** 2026-04-22T13:02:04Z
- **Completed:** 2026-04-22T13:05:40Z
- **Tasks:** 2 (Task 1 executed as TDD RED → GREEN; Task 2 as feat)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `selectProximityComments` pure helper + `ProximityComment` type in `apps/web/lib/canvas-utils.ts`. Filters to agent_message events only; picks up to windowSize (default 5) nearest by |seq distance|; ties break to the lower seq; returns entries sorted ascending by seq with before/at/after position labels.
- 9 vitest assertions in `apps/web/lib/canvas-utils.test.ts` covering every behavior bullet in the plan spec (empty input, no-agent-message runs, non-agent-message ignoring in the proximity window, default windowSize=5 clamping, fewer-than-windowSize result, sort-ascending output invariant, proximity pick example, position labels, tie-break-to-lower-seq).
- `PREVIEWABLE_MIMES` exported from `apps/web/components/transcript/artifact-card.tsx` (previously module-local) so Canvas and ArtifactCard share one allowlist definition.
- `ArtifactPreviewInline` component added to `apps/web/components/transcript/artifact-preview-panel.tsx`: same fetch + loading skeleton + pdf iframe + docx html + unsupported fallback logic as the Dialog variant, with `h-full w-full` wrapper and no Dialog chrome. Fetches on mount and whenever `artifactId` changes (no `open` gating — the caller controls lifecycle by mounting/unmounting).
- `ArtifactPreviewPanel` refactored to compose `ArtifactPreviewInline` internally, gated by `{open && ...}` so the child only mounts when the dialog is open — preserves the prior fetch-on-open behavior without duplicating any fetch/render code.
- `CanvasView` component at `apps/web/components/run-views/canvas-view.tsx`:
  - Reads `artifacts` and `messages` from `useRunStore`.
  - 0 artifacts → centered empty state "No artifacts delivered yet — Canvas will populate as agents produce outputs".
  - >1 artifacts → pill-strip selector at the top (amber-500 active, muted-foreground inactive, shrink-0 for horizontal scroll on wide runs).
  - 1 artifact → auto-selected, no strip.
  - Two-pane layout: `flex-[7]` preview + `flex-[3]` rail on ≥768px (`md:flex-row`); stacked column below that breakpoint.
  - Previewable mimes render via `<ArtifactPreviewInline />`; non-previewable types show filename + formatted size + a Download link to `/api/artifacts/:id/download`.
  - Comment rail calls `selectProximityComments(selected.sequenceNumber, messages, 5)`; each entry renders as a compact agent-colored row with `getAgentConfig().displayName`, a before/at/after label, and a 160-char text preview.
  - Empty rail shows "No nearby agent commentary".
  - Self-healing selection: `useEffect` re-points `selectedArtifactId` to `artifacts[0]` if the current id disappears from the store.
- `run-view-tabs.tsx` wired: Canvas panel placeholder (`Canvas view — coming in 11-04`) replaced with `<CanvasView runId={runId} />`; `data-testid="run-view-canvas"` preserved; Timeline (11-02) and Boardroom (11-03) panels untouched.
- Full apps/web vitest suite stays green (54/54, up from 45/45 after the 9 new canvas-utils assertions). `pnpm exec tsc --noEmit` exits 0.

## Task Commits

1. **Task 1 (RED):** `69fdbbc` — `test(11-04)` failing tests for canvas-utils selectProximityComments (module does not yet exist).
2. **Task 1 (GREEN):** `95424ef` — `feat(11-04)` canvas-utils + shared PREVIEWABLE_MIMES + ArtifactPreviewInline; 9/9 tests pass.
3. **Task 2:** `0333162` — `feat(11-04)` implement CanvasView and wire into run-view tabs.

_Task 1 followed the TDD gate (RED then GREEN); no REFACTOR commit was needed — the implementation matched the plan skeleton on the first green. Task 2 did not create a new test file (the plan's `<verify>` for Task 2 is `tsc --noEmit`; behavioral coverage lives in canvas-utils pure helper)._

## Files Created/Modified

- `apps/web/lib/canvas-utils.ts` — `selectProximityComments(selectedArtifactSeq, messages, windowSize=5)` and `ProximityComment` interface. 57 lines. No React imports. Pure data-shaping helper.
- `apps/web/lib/canvas-utils.test.ts` — 9 `it(...)` blocks in a single `describe` suite. Uses a `mkEvent()` fixture helper.
- `apps/web/components/run-views/canvas-view.tsx` — `'use client'` component. 195 lines. Exports `CanvasView`. Inner `ArtifactContent` alias type at the boundary; `formatSize` module-local helper.
- `apps/web/components/transcript/artifact-card.tsx` — single-line change: `const PREVIEWABLE_MIMES` → `export const PREVIEWABLE_MIMES = new Set<string>([...])`. ArtifactCard's own usage unchanged.
- `apps/web/components/transcript/artifact-preview-panel.tsx` — full refactor. Extracted the body into `ArtifactPreviewInline` (fetches on mount, no Dialog chrome, `h-full w-full` wrapper). `ArtifactPreviewPanel` now wraps Dialog chrome around `{open && <ArtifactPreviewInline/>}`. Both exports present; Dialog primitives (Root, Portal, Backdrop, Popup, Close, Title) preserved; ArtifactCard's consumption of `ArtifactPreviewPanel` unchanged (no call-site edits needed).
- `apps/web/components/run-views/run-view-tabs.tsx` — imports `CanvasView` alongside existing `WritersRoomView`/`TimelineView`/`BoardroomView`; Canvas TabsPanel body replaced. Tab switcher logic, `data-testid` attributes, and all other panels untouched.

## Decisions Made

- **Inline + Dialog variants co-located in one file:** `ArtifactPreviewInline` and `ArtifactPreviewPanel` share the `PreviewData` union type and the same fetch/render shape. Splitting would force re-exporting the private type or duplicating it. Co-location keeps both paths side-by-side so future fetch-body changes touch a single file. The file grew from 148 → 186 lines — still small.
- **`{open && <ArtifactPreviewInline/>}` gate in the Dialog:** The original `ArtifactPreviewPanel` had a `useEffect` that early-returned when `!open`, avoiding the fetch while the dialog was closed. The inline child has no `open` concept — it always fetches on mount. Wrapping with `{open && ...}` unmounts the child when the dialog closes, which preserves the prior fetch-on-open behavior without adding an `open` prop to the inline variant (which would defeat its "no gating" purpose for Canvas).
- **Tie-break to the LOWER sequence number:** The plan spec said "ties break to the LOWER sequence number". This is both deterministic and semantically natural — in a left-to-right narrative, earlier events ("before") typically set up artifacts, so preferring them on equal-distance ties reads naturally.
- **No URL-sync for artifact selection:** CONTEXT.md reserved URL state for `?view=<tab>` only. Per-artifact selection inside the Canvas tab is ephemeral (`useState`) — reloading the page returns to the default (artifacts[0]). This keeps the URL clean and avoids param bloat on shared links.
- **Self-healing `selectedArtifactId`:** If the selected artifact's id disappears (e.g., Canvas is viewed while store state changes in ways we don't anticipate), a `useEffect` re-points to `artifacts[0]`. The fallback also covers the case where Canvas mounts before any artifact arrives (initial `firstArtifactId` is null; updates trigger the effect).
- **160-char text preview on margin comments:** Longer than Timeline's tooltip preview (80) because the rail is vertical and not cramped. Fits cleanly in ~2 lines at the rail's font size (`text-[11px]`).
- **Proximity-only, no text parsing:** This is explicit non-functionality per CONTEXT.md §Canvas view — annotation systems are a deferred item. Implementing proximity-only now keeps the surface minimal and lets a future phase add true artifact-reference parsing without renaming or restructuring.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria pass:

- Task 1:
  - `export const PREVIEWABLE_MIMES` present in `artifact-card.tsx` ✓
  - Both `ArtifactPreviewPanel` and `ArtifactPreviewInline` exported from `artifact-preview-panel.tsx` ✓
  - `DialogPrimitive.Root`, `DialogPrimitive.Popup`, `DialogPrimitive.Close` all still present in `artifact-preview-panel.tsx` ✓
  - `{open && <ArtifactPreviewInline` present (gated fetch) ✓
  - `canvas-utils.ts` exports `selectProximityComments` and `ProximityComment` ✓
  - `canvas-utils.ts` contains the agent_message filter + `windowSize = 5` default ✓
  - 9 `it(` blocks in `canvas-utils.test.ts` ✓
  - `pnpm exec vitest run lib/canvas-utils.test.ts` 9/9 green ✓
  - Existing ArtifactPreviewPanel usage from ArtifactCard still compiles — tsc clean ✓

- Task 2:
  - `export function CanvasView` present ✓
  - Canvas imports `ArtifactPreviewInline`, `PREVIEWABLE_MIMES`, `selectProximityComments` ✓
  - Empty state literal "No artifacts delivered yet — Canvas will populate as agents produce outputs" present (JSX multi-line — flattened to a single string by React) ✓
  - Empty rail literal "No nearby agent commentary" present ✓
  - `flex-[7]` and `flex-[3]` both present (4 occurrences total: component + import class strings) ✓
  - `md:flex-row` present ✓
  - `/api/artifacts/:id/download` download link present ✓
  - `run-view-tabs.tsx` imports `CanvasView`, renders `<CanvasView runId={runId} />`, keeps `data-testid="run-view-canvas"`, drops the `coming in 11-04` placeholder ✓
  - `<TimelineView` + `<BoardroomView` still present in `run-view-tabs.tsx` (prior waves preserved) ✓
  - `pnpm exec tsc --noEmit` exits 0 ✓
  - `pnpm exec vitest run` (full suite) 54/54 green ✓

## Issues Encountered

None.

## User Setup Required

None — no external service, env var, or infrastructure change. Manual UAT per CONTEXT.md §Testing happens after Phase 11 wraps (Plan 05 deploy + UAT).

## Next Phase Readiness

- Canvas tab is reachable at `/projects/:p/runs/:r?view=canvas` and behaves per CONTEXT.md §Canvas view.
- All four tabs (Writers' Room, Timeline, Boardroom, Canvas) are now wired — Plan 05 (deploy + UAT) can proceed.
- Writers' Room, Timeline, and Boardroom panels are unchanged — no regression introduced (verified via full vitest suite green + tsc green).
- ArtifactCard's dialog usage (`/projects/:p/runs/:r` transcript → click View on a pdf/docx artifact → slide-over preview) continues to work — the inline child is mounted when `open=true` and fetches on mount, matching the prior fetch-on-open semantics.
- No backend changes, no SSE changes, no DB migrations — Canvas is 100% client-side over existing `useRunStore` state and the existing `/api/artifacts/:id/preview` + `/api/artifacts/:id/download` endpoints from Phase 07.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. The plan's threat model (T-11-10 docx XSS accept, T-11-11 margin-comment XSS mitigate, T-11-12 stale selection accept) is honored:

- **T-11-10:** The `dangerouslySetInnerHTML` path in `ArtifactPreviewInline` is unchanged from the pre-refactor `ArtifactPreviewPanel` body — identical fetch, identical prop shape, identical mammoth-sanitized HTML source. No new trust boundary.
- **T-11-11:** Margin comment text renders as a React text child (`{text.slice(0, 160)}`) — angle brackets auto-escaped; no `dangerouslySetInnerHTML`.
- **T-11-12:** Selection falls back to `artifacts[0]` via `useEffect` when the selected id disappears. Worst case the user sees the first artifact for a frame — acceptable per the threat register.

## Self-Check: PASSED

- `apps/web/lib/canvas-utils.ts` — FOUND
- `apps/web/lib/canvas-utils.test.ts` — FOUND
- `apps/web/components/run-views/canvas-view.tsx` — FOUND
- `apps/web/components/transcript/artifact-card.tsx` — MODIFIED (PREVIEWABLE_MIMES now exported)
- `apps/web/components/transcript/artifact-preview-panel.tsx` — MODIFIED (ArtifactPreviewInline + ArtifactPreviewPanel both exported; inline composed by dialog)
- `apps/web/components/run-views/run-view-tabs.tsx` — MODIFIED (CanvasView import + panel wiring; `coming in 11-04` placeholder removed)
- Commit `69fdbbc` (test RED) — FOUND in `git log`
- Commit `95424ef` (feat GREEN) — FOUND in `git log`
- Commit `0333162` (feat Task 2) — FOUND in `git log`
- `pnpm exec vitest run lib/canvas-utils.test.ts` — 9/9 passed
- `pnpm exec vitest run` (full apps/web suite) — 54/54 passed
- `pnpm exec tsc --noEmit` — exit 0
- Timeline (11-02) and Boardroom (11-03) panel bodies untouched — regression-free
- Canvas placeholder string `"coming in 11-04"` absent — confirmed via grep

---
*Phase: 11-run-view-tabs-writers-room-timeline-boardroom-canvas*
*Completed: 2026-04-22*
