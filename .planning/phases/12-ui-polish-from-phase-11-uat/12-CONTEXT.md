# Phase 12: UI Polish from Phase 11 UAT — Context

**Gathered:** 2026-04-27
**Status:** Ready for planning
**Source:** UAT screenshots from user (Lucas) on 2026-04-27 against console.beaglemind.ai (Phase 11 deployed). This phase is the gap-fill from Phase 11 plan 5 (UAT checkpoint).

<domain>
## Phase Boundary

Polish the look-and-feel surfaces that shipped in Phases 4–11, addressing four concrete defects observed during Phase 11 UAT. Track A scope only — visual/layout fixes. State-machine and lifecycle bugs (Track B: stuck `executing` runs, status/cost mismatch, zero artifact counts) are deferred to a separate phase.

The four UAT defects, with screenshot references at
`C:\Users\LucasTraber\OneDrive - Hanseatic Corporation\Pictures\Screenshots\Screenshot 2026-04-27 09{0945,1005,1015,1025,1042}.png`:

1. **Run History page renders in light theme** (091042) while every other view is dark. The dashboard layout sets `<html className="dark">` and `bg-bg`, but the rendered Run History reads as light/white. Outcome should be: Run History matches the rest of the app at all times, regardless of hydration timing or browser state.

2. **Writers' Room empty state is a dead screen** (091005). When a run is mid-flight with no agent messages yet (only the existing thin orange progress bar), ~80% of the canvas is black void. Outcome should be: while waiting for the first agent event, render a skeleton showing the participating agents (avatar + name + "thinking…" state) so the screen reads as "loading" instead of "broken."

3. **Speaker attribution is weak in single-column Writers' Room** (090945). Author labels (`Mo`, `Jarvis`, `herman`) blend into prose; `herman` falls through to the default config and renders lowercase + gray because there is no entry in `AGENT_CONFIG`. Outcome should be: every agent that can appear in the transcript has a configured display name (capitalized), a role label, an avatar color, and a name color — and the speaker block is visually distinct enough to scan a long thread without re-reading.

4. **Run page header shows only the run UUID** (090945, 091005). When you switch between tabs or come back to a run, you cannot tell what the run is about without scrolling. Outcome should be: the run header shows the user's prompt as a one-line truncated title above (or alongside) the existing status chip + UUID, so the run is identifiable at a glance.

**What this phase does NOT do:**
- Track B work (run lifecycle, artifact counts, cost/status sync). Those are bugs in worker / API / state machine, not UI.
- New layouts, redesigns, or wireframe additions. Existing layouts stay.
- Composer redesign (verbosity slider re-position, Send button styling). Logged in deferred — fix only if trivially adjacent.
- Process drawer additions / Mobile-specific work / Responsive review.
- Theme system overhaul. The fix for #1 should be the smallest change that makes light theme impossible to render.
- Adding `sentinel` / `sam` to `AGENT_CONFIG` unless they actually appear in the transcript today.

</domain>

<decisions>
## Implementation Decisions

### Defect 1 — Dark Run History

- **Approach:** Make the dark palette unconditional. The simplest fix is to make `:root` in `apps/web/app/globals.css` use the same color tokens as `.dark`, so the page is dark even before/independent of the `dark` class being on `<html>`. This removes the hydration-window window where light shows through and removes any need for theming logic.
- **Out of scope:** Adding a user-facing light/dark toggle. The product has no light theme by design.
- **Verification:** Open `/runs` in a fresh incognito session, hard reload, observe dark background on first paint and after hydration.

### Defect 2 — Writers' Room loading skeleton

- **Trigger condition:** `eventOrder.length === 0` in `useRunStore` (already the existing empty-state branch in `components/transcript/message-list.tsx`).
- **Replace** the current "Waiting for events..." centered text with a skeleton component that:
  - Renders 3 stacked `AgentMessage`-shaped placeholders, one per expected agent (Mo, Jarvis, Herman in that order).
  - Each placeholder uses the real `AgentAvatar` + agent display name + role from `AGENT_CONFIG`, plus a "thinking…" line in muted text and a faint pulsing skeleton bar where message text would go.
  - Subtitle line above the placeholders: "Mo, Jarvis, and Herman are getting ready…" centered, muted, smaller.
- **Agents shown:** Hard-code Mo / Jarvis / Herman for now — these are the only agents the project routes to today. If this changes, update both the skeleton list and `AGENT_CONFIG` in the same plan.
- **No new run-store fields.** The skeleton is pure-derived from `eventOrder.length === 0`. Once any event arrives, the existing `MessageList` rendering takes over.

### Defect 3 — Speaker chips + agent config completeness

- **Add `herman` and `sam` to `AGENT_CONFIG`** in `apps/web/lib/agent-config.ts`:
  - `herman`: `displayName: 'Herman'`, `role: 'open-weight researcher'`, `bgColor: 'bg-[#a855f7]'`, `textOnBg: 'text-[#1a0833]'`, `nameColor: 'text-purple-400'`, `initial: 'H'`.
  - `sam`: `displayName: 'Sam'`, `role: 'sentinel'`, `bgColor: 'bg-[#ef4444]'`, `textOnBg: 'text-[#3a0808]'`, `nameColor: 'text-red-400'`, `initial: 'S'`.
  - These colors must not collide with the existing palette (Mo amber / Jarvis teal / Sentinel purple / User blue). Note: the existing `sentinel` entry remains for the synthetic `sentinel_flag` event source; `sam` is a separate agent identity.
- **Strengthen the speaker block in `components/transcript/agent-message.tsx`:**
  - Wrap the name + role line in a pill / chip background using the agent's `bgColor` at low opacity (e.g. `bg-[#f7b733]/15` for Mo) with the agent's `nameColor` for text. Keep the avatar as-is to its left.
  - Increase the name's font weight from `font-medium` to `font-semibold` and the size from `text-sm` to `text-[13px] leading-tight` for higher contrast vs. body text.
  - Keep the existing role and timestamp lines, but render them on a second row inside the chip when space allows, otherwise the existing inline layout.
- **Casing:** Once `herman` is configured, its `displayName` ("Herman") will replace the raw lowercase agentId fallback. Existing `Mo` / `Jarvis` already capitalized correctly.
- **Cost row** in the process drawer should also use display names (capital `Mo`, `Jarvis`, `Herman`) — fix at the cost-row formatter, not by mutating the config map.

### Defect 4 — Run page title from prompt

- **Source of truth:** The prompt is on `runs.prompt` in the DB and is already returned by the run-history endpoint. The streaming run page does not currently fetch it. Add a tiny endpoint (`GET /api/runs/[id]/title`) returning `{ prompt: string | null }` OR include it in an existing run-fetching endpoint. Prefer extending an existing endpoint over adding a new route.
- **Render:** Above the status badge row in `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx`, render `<h1>` with the prompt truncated to ~120 chars and ellipsized via CSS (`truncate`). Hover/title attribute = full prompt. If the prompt is null/empty, fall back to "Untitled run".
- **No layout shift on stream:** Title block must reserve its line height even before the title fetches, so the SSE event area does not jump on hydration.

### Cross-cutting

- **Tests:** Unit-test pure helpers if any are introduced (e.g., a `formatAgentList` that renders "Mo, Jarvis, and Herman" from an array). No integration tests required — these are visual changes verified by re-running UAT against console.beaglemind.ai.
- **Deploy:** Single deploy at end of phase using the existing manual workflow (push to GitHub → SSH `beaglehq` → `git pull` in `/tmp/beagle-build` → `docker build` → `docker compose up -d --force-recreate console-web`).
- **Single commit per defect**, atomic, following existing GSD commit conventions (`feat(12-NN):`, `fix(12-NN):`).

### Claude's Discretion

- Exact opacity / radius / padding for speaker chips.
- Whether the loading skeleton uses 3 fixed placeholders or one placeholder per `AGENT_CONFIG` entry — pick whichever reads cleaner; defaults are listed above.
- Exact `<h1>` font size for the run title (`text-base` to `text-lg`).
- Whether to extend an existing API or add the title endpoint — pick the smaller diff.
- Color choices for new `herman` / `sam` agent configs as long as they don't collide with the existing palette.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files this phase will touch
- `apps/web/app/globals.css` — defect 1 (force `:root` to dark palette).
- `apps/web/components/transcript/message-list.tsx` — defect 2 (replace empty-state branch).
- `apps/web/components/transcript/agent-message.tsx` — defect 3 (speaker chip).
- `apps/web/lib/agent-config.ts` — defect 3 (add `herman`, `sam`).
- `apps/web/components/studio/process-drawer.tsx` — defect 3 follow-on (cost row display names; only if it currently formats raw lowercase ids).
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — defect 4 (title block).
- `apps/web/app/api/runs/[id]/...` — defect 4 (extend an endpoint or add `/title`).

### Existing components to read but NOT modify
- `apps/web/components/transcript/agent-avatar.tsx` — reuse in skeleton.
- `apps/web/lib/stores/run-store.ts` — for the `eventOrder` predicate.
- `apps/web/components/run-views/run-view-tabs.tsx` — boundary; skeleton must live inside the Writers' Room view path.

### Conventions
- Tailwind v4 + shadcn primitives. Use `text-foreground`, `text-muted-foreground`, `border-white/10` token style already in use.
- Color hex values for agents must match the existing palette (`#f7b733`, `#4db6ac`, `#c86bff`, `#6ea8fe`).

</canonical_refs>

<specifics>
## Specific Ideas

- The Phase 11 commit history shows `state_transition` events get filtered in Clean mode in Boardroom/Timeline — preserve this filtering in any new view-aware code touching event lists.
- Phase 4-06 already established the agent color map (Mo amber-500, Jarvis teal-500, user blue-400). Use the same Tailwind palette for the `nameColor` token in new `AGENT_CONFIG` entries.
- The skeleton's "Mo, Jarvis, and Herman are getting ready…" line is purely decorative — do NOT key off any backend "expected agents" signal that doesn't exist yet.
- Consider extracting a tiny `useRunPrompt(runId)` TanStack Query hook so the title block fetches once and dedupes across re-renders.

</specifics>

<deferred>
## Deferred Ideas (Track B and beyond)

- Run lifecycle bug: every Run History row is `executing` after 5 days. Worker auto-complete and SSE close path don't terminate the state machine. Open as a separate phase under Track B.
- Status/cost mismatch: a run with $1.75 spent shows `pending`. State machine transition out of `pending` not firing on first cost event.
- Artifact count is `0` for every run in Run History — query or schema bug, not UI.
- Composer cleanup: verbosity slider crowds the input; `Send` button looks disabled even when active.
- Process drawer densification: more content (active agents, plan-approval queue, current model) and tighter spacing. Out of scope here.
- Run-title block could grow into a breadcrumb (`Project / Run`) once projects gain richer naming.
- Light theme as a real product mode (not planned).

</deferred>

---

*Phase: 12-ui-polish-from-phase-11-uat*
*Context gathered: 2026-04-27 from UAT screenshots*
