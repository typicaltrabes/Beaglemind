# Phase 13: UI Polish Round 2 + Tabs Redesign + Settings + Title Summarization — Context

**Gathered:** 2026-04-27
**Status:** Ready for planning
**Source:** Lucas's second UAT pass against console.beaglemind.ai immediately after Phase 12 deployed. Seven items captured in the conversation; no separate screenshots — defects are derived from the live state.

<domain>
## Phase Boundary

Seven distinct items, scoped together because Lucas wants them shipped in one autonomous run. They split naturally into three tracks of decreasing scope clarity:

**Track A — concrete UI bugs (high confidence):**
1. **Horizontal scroll on the run page.** The run page exceeds viewport width and forces a horizontal scrollbar to see the rightmost content. Investigate root cause — likely the run-title `<h1>` from Plan 12-04 (no `truncate` constraint when nested in a flex container with `min-w-0` missing), or the four-tab strip pushing the layout wider than the parent. Fix so the page never scrolls horizontally on viewports ≥1024px.
4. **Avatar / speaker chip overflows the left edge of the message column.** The chip restyle from Plan 12-02 added padding that visually pushed the avatar tight against the left container border. Add horizontal padding inside the message-column container so avatars sit ~12px from the edge instead of flush.
5. **Run UUID display is ugly.** The header still shows the full raw UUID (`275423d3-0485-475b-bc0c-bba1631918bf`). Replace with a short slug — first 8 chars prefixed with `#` — rendered in a monospaced font with hover-to-copy and a "Run ID copied" toast on click. Keep the full UUID accessible via copy and as a `title=` attribute.

**Track B — feature work (medium scope):**
2. **Run title summarization.** Today the run page header shows the full prompt as `<h1>` — for long prompts this overflows. Generate a 6–8 word title from the prompt at `runs.create` time. Store on `runs.title` (column already exists per Phase 4 schema, was removed in Phase 4 D-02 but the migration history shows it can be re-added — verify with the planner). Fall back to truncated prompt if generation fails or is in flight. Use Haiku 4.5 through LiteLLM (`claude-haiku` or `anthropic/claude-haiku-4-5` depending on registered alias on BeagleHQ LiteLLM at `litellm.beaglemind.ai`). This is a 6-word generation, NOT reasoning — Lucas's "no Haiku" rule applies to reasoning tasks, not low-stakes summarization. Confirmed with Lucas during this UAT pass.
6. **Settings page at `/settings`.** New dashboard route for user prefs. Four prefs to start:
   - `theme` — `dark | light | auto` (default `dark`). Reintroduces the light theme that Phase 12-01 effectively killed by forcing `:root` to dark; the `:root` change must now apply only when theme=dark or system=dark.
   - `defaultTab` — `writers-room | timeline | boardroom | canvas` (default `writers-room`). Drives the initial `?view=` on a freshly-opened run.
   - `defaultVerbosity` — `quiet | normal | full` (default `normal`). Drives the verbosity slider's starting position.
   - `browserNotifications` — `on | off` (default `off`). Controls whether new push subscriptions are offered on this device.
   Persist on `users.preferences` JSONB column (add via migration). Server-rendered as the source of truth, hydrated to a Zustand store on the client. Settings page itself is a simple shadcn form, save-on-change with optimistic UI.

**Track C — bigger redesign (lower scope clarity):**
3. **"Improve my prompt" button.** A button in the composer (next to Send) that opens a popover with the user's draft, calls Haiku via LiteLLM to rewrite it for clarity and structure, and lets the user accept / edit / cancel. Lucas confirmed during this UAT pass that Haiku is acceptable for this rewrite tool (it's a structural cleanup, not reasoning) — so this ships **fully wired**, not as a stub. Endpoint: `POST /api/runs/improve-prompt { prompt: string } -> { rewritten: string }`. System prompt: "Rewrite the user's prompt to be clearer, better-structured, and more specific. Keep the user's intent. Do not add new requirements or scope. Output only the rewritten prompt, no preamble." Popover UX: shows the original on top, the rewrite below in an editable textarea, three buttons: "Use rewrite" (replaces composer), "Edit and keep" (closes popover, leaves composer with rewrite text), "Cancel" (closes popover, leaves composer untouched).
7. **Tab differentiation redesign — Writers' Room / Timeline / Boardroom / Canvas.** Lucas's complaint: "they all kind of do the same thing." Root cause: Phase 11 shipped tab switching but each tab's distinguishing affordance is missing or invisible.
   - **Writers' Room** — chronological single-column "watch them think" view. KEEP AS-IS — this is the default, and it's working.
   - **Timeline** — must add a real scrub/replay UX. Today it shows a horizontal lane of dots that's ostensibly a timeline but offers no replay control. Required: a play/pause/scrub bar at the bottom of the panel; clicking play animates a playhead through events at ~2× real time; clicking a dot jumps to that point and shows the event in a detail pane below. The "rewind to a point" affordance is what makes Timeline worth a separate tab.
   - **Boardroom** — must visually emphasize parallel-time alignment between agents. Today it's three columns sorted independently. Required: a grid where rows are scenes (or time-buckets if no scenes) and columns are agents — so you can scan horizontally and see what each agent said in the same scene. Empty cells render as a faint horizontal rule, not whitespace, so the alignment is visible. This is the "compare what each said at the same moment" affordance.
   - **Canvas** — must have a first-class empty state. Today the panel is empty when no artifacts exist (which is most runs). Required: when artifacts.length === 0, show a centered card explaining what Canvas does — "Canvas surfaces the run's deliverables. Documents, code, and data the agents produce will appear here with related discussion in the margins." — plus the run prompt as a header, and a faint preview of the document-frame placeholder.

**What this phase does NOT do:**
- (Item 3 IS now fully wired — Lucas approved Haiku for the rewrite tool during this UAT pass.)
- A user-onboarding flow for the settings page (Lucas will discover it via the avatar/menu).
- A fundamental redesign of the speaker chip (only the avatar-edge padding fix from item 4).
- Re-implementing light-theme tokens for every component (only ensures `:root` is dark unless overridden, and the existing light tokens kept by shadcn are reused).
- A Track D for the OpenClaw update on Jarvis (model 4.7 not yet supported) — separate operational task.

</domain>

<decisions>
## Implementation Decisions

### Item 1 — Kill the horizontal scrollbar
- **First:** reproduce in a 1280×800 viewport against the deployed `console.beaglemind.ai` to confirm the offending element. Likely culprits in priority order: (a) run-title `<h1>` missing `truncate` + parent missing `min-w-0`; (b) `RunViewTabs` tab strip overflowing; (c) `Process` drawer width pushing main column.
- **Fix:** add `min-w-0` to the run page's main flex column, ensure the title `<h1>` has `truncate` AND `min-w-0` on its container, and guard the tab strip with `overflow-x-auto` if it must overflow on narrow viewports — but never the page-level container.
- **Verification:** run a Playwright/Vitest smoke test (or just manual UAT) confirming `document.documentElement.scrollWidth === document.documentElement.clientWidth` at 1280px on the run page.

### Item 4 — Avatar edge padding
- Today: `<div className="flex gap-3 py-2">` is the row container. Avatar sits flush left.
- Fix: add `px-4` (or align with the existing message-list container padding — read it before deciding) to the row OR to the surrounding scroll container so avatars start ~16px in. Don't touch the avatar itself.
- Verification: chip's left edge is at least 16px from the panel's left border.

### Item 5 — Run UUID short slug
- Replace `<span className="truncate text-xs text-gray-600">{runId}</span>` with a `<button>` rendering `#${runId.slice(0,8)}` in `font-mono text-xs text-muted-foreground hover:text-foreground`. On click, copy the full `runId` to clipboard via `navigator.clipboard.writeText(runId)`. Show a 1.5-second toast "Run ID copied" via the existing toast pattern (look at how shareable-links currently confirms copy — it uses inline state, not a toast lib; reuse that pattern).
- The full UUID stays accessible via `title={runId}` on the button.

### Item 2 — Run title summarization
- **Storage:** add `title VARCHAR(80)` column to `runs` table via migration. Verify in the planner whether D-02 (Phase 4) "Removed title from runs table" actually dropped the column or just stopped writing to it — re-add if dropped, alias if still present.
- **Generation timing:** at run creation, after the row is inserted, enqueue a BullMQ job `generate-run-title` with `{ runId, prompt }`. Worker calls LiteLLM with `model: "claude-haiku"` (or whatever alias resolves to Haiku 4.5 — confirm against `litellm.beaglemind.ai` registry) on a tight system prompt: "Summarize this user prompt in 6-8 words for a UI title. Output only the title, no quotes, no period." Update `runs.title` when complete. Worker timeout: 10s. On failure, leave `title NULL` (UI falls back to truncated prompt).
- **UI:** the run page header reads `run.title ?? truncate(run.prompt, 80)`. Show a faint shimmer skeleton when `title IS NULL` and `now - createdAt < 10s` (still generating).
- **Run history table:** the existing Prompt column should also use `title ?? prompt` and become the Title column. Header label change: "Prompt" → "Title".
- **No retroactive backfill** for old runs in this phase — they keep showing their prompt. Add a follow-up backfill job to backlog.

### Item 6 — Settings page
- **Route:** `/settings` under `(dashboard)` so it inherits the shell.
- **Schema migration:** add `preferences JSONB NOT NULL DEFAULT '{}'::jsonb` to `users` table. Drizzle column.
- **Server route:** `GET /api/me/preferences` and `PATCH /api/me/preferences` (auth-required, scoped to current user). Validate with Zod.
- **Client:** `useUserPreferences()` TanStack Query hook + Zustand store mirror for synchronous reads in render paths. Settings page is a single shadcn form with four fields, save-on-change (debounced 400ms).
- **Theme application:** add a `<ThemeProvider>` at the dashboard layout that reads `preferences.theme`, syncs with system if `auto`, and toggles `<html>` class between `dark` and (no class). Update `globals.css` so the dark overrides remain in `.dark` AND the `:root` change from Plan 12-01 only applies when theme is `dark` (revert `:root` to the original light tokens; the `<html className="dark">` from layout.tsx ensures dark stays the visible default until a user opts into light).
- **Default tab + default verbosity:** read from preferences in `RunViewTabs` and `Composer` respectively, fall back to current hard-coded defaults.
- **Browser notifications:** flip the existing PushPermission prompt from "always offer" to "only offer when preferences.browserNotifications === 'on' AND no subscription registered yet."
- **No password / MFA changes** in this phase — Better Auth already provides those flows separately. Settings is for app prefs only.

### Item 3 — Improve my prompt button (FULLY WIRED — Lucas approved Haiku for this tool)
- **Composer change:** add an "Improve" button (icon: `Sparkles` from lucide-react) immediately to the LEFT of the Send button. On click, open a base-ui Popover anchored to the composer.
- **Popover content:** the composer's current prompt rendered (read-only) at top with a label "Original"; an editable textarea below labeled "Improved (suggested)" pre-filled with the rewrite once it returns; three buttons: `Use rewrite` (replaces composer with the textarea contents and closes popover), `Edit and keep` (closes popover, replaces composer with the textarea contents so user can keep editing), `Cancel` (closes popover, no change). While the LLM call is in flight, the textarea shows a centered spinner.
- **Endpoint:** `POST /api/runs/improve-prompt { prompt: string }` → `{ rewritten: string }`. Auth-required, scoped to current user. Calls LiteLLM with `model: "claude-haiku"` (or whatever alias resolves to Haiku 4.5 — verify against `litellm.beaglemind.ai`). System prompt: `"Rewrite the user's prompt to be clearer, better-structured, and more specific. Keep the user's intent. Do not add new requirements or scope. Output only the rewritten prompt, no preamble or commentary."` Temperature: 0.2 (low, deterministic). Max tokens: 800. Timeout: 8s — on timeout, return HTTP 504 with `{ error: "rewrite timed out — try again" }`.
- **Rate-limit consideration:** trivially low-cost per call (Haiku, 800 tokens) but add a per-user 30-req/min in-memory limiter to prevent button-spam abuse. Use a simple Map<userId, timestamps[]> in the route file (no Redis — overkill for this).
- **Test:** unit-test the endpoint with a stubbed LiteLLM client returning a fixed string; assert response shape and 200 status.

### Item 7 — Tab differentiation

#### Writers' Room
- No changes. Writers' Room is the working baseline.

#### Timeline
- Add a play/pause/scrub bar at the bottom of the Timeline panel:
  - Left side: `▶ Play` / `⏸ Pause` button.
  - Center: a horizontal range slider whose value indexes into `eventOrder`.
  - Right side: speed multiplier `1× / 2× / 4×` (default 2×).
- When playing, advance the playhead one event every `400ms / speedMultiplier`. When the playhead lands on an event, render that event in a detail pane below the timeline (same `renderEvent` helper as Writers' Room). Pause auto-stops on reaching the last event.
- The dot lane stays — but dots are now visually highlighted as the playhead passes them (saturated color for played, dim for unplayed). This is the "scrubbable replay" affordance.
- Empty state if `eventOrder.length === 0`: "Run has not started yet — Timeline activates once events arrive."

#### Boardroom
- Replace the "three columns sorted independently" layout with a **scene-aligned grid**:
  - Rows: each scene from `scenes`. If no scenes have started, fall back to one row labeled "Run".
  - Columns: each unique agent in `messages` (Mo / Jarvis / Herman / user, in that order; user always last column).
  - Cell content: that agent's events in that scene, rendered with `renderEvent`. Empty cells: a faint horizontal rule (`<div className="border-t border-white/5" />`).
  - Sticky scene-row header: scene name + start timestamp.
- Mobile (<768px) keeps the existing accordion fallback unchanged.
- Empty state: "No agent activity yet."

#### Canvas
- When `artifacts.length === 0` (the common case today), render an empty-state card centered in the panel:
  ```
  ┌──────────────────────────────────────────────────────────┐
  │  Canvas: deliverables view                               │
  │                                                          │
  │  This run has no artifacts yet.                          │
  │                                                          │
  │  Canvas surfaces documents, code, and data the agents    │
  │  produce, with related discussion shown in the margins.  │
  │                                                          │
  │  Run prompt:                                             │
  │  > {truncated run.title or prompt}                       │
  └──────────────────────────────────────────────────────────┘
  ```
- The card uses muted styling — `border border-white/10 bg-white/[0.02]` — so it reads as informational, not error.
- When artifacts exist, behavior is unchanged from Phase 11.

### Cross-cutting
- **Single deploy at end of phase**, same workflow as Phase 12.
- **Migrations:** two small ones (runs.title, users.preferences). Both additive, nullable / defaulted, so no downtime risk.
- **No new external services.** Title generation reuses LiteLLM that's already deployed at `litellm.beaglemind.ai`.
- **Atomic commits per defect**, scope `feat(13-NN):` / `fix(13-NN):` like Phase 12.
- **Tests:** unit-test pure helpers (any title-truncation, scene-bucketing helpers introduced); skip integration tests for the visual changes (verified by UAT).
- **Pre-flight:** run typecheck + vitest before deploy.

### Claude's Discretion
- Exact pixel/padding values for items 4 and 5.
- Shadcn vs. base-ui primitive choice for the popover (use whichever is already in the project).
- Whether to extract a shared `<EmptyState>` component for Canvas/Timeline/Boardroom or inline each (suggestion: extract; three of them appear in this phase).
- Worker concurrency for title generation (suggestion: 4, since BullMQ already running).
- Whether to add a "Regenerate title" affordance on the run page header (suggestion: NOT in this phase — defer to backlog).
- Whether the Boardroom scene-aligned grid uses CSS Grid (`grid-template-columns: repeat(N, minmax(280px, 1fr))`) or flex with explicit widths. Pick the more responsive one.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files this phase will touch
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — items 1, 2, 5
- `apps/web/components/transcript/agent-message.tsx` — item 4
- `apps/web/components/transcript/composer.tsx` — item 3 (Improve button + popover)
- `apps/web/components/run-views/timeline-view.tsx` — item 7 Timeline
- `apps/web/components/run-views/boardroom-view.tsx` — item 7 Boardroom
- `apps/web/components/run-views/canvas-view.tsx` — item 7 Canvas
- `apps/web/components/runs/run-history-table.tsx` — item 2 column rename
- `apps/web/app/(dashboard)/settings/page.tsx` — item 6 (NEW)
- `apps/web/app/(dashboard)/dashboard-shell.tsx` — item 6 (settings link in user menu)
- `apps/web/app/api/runs/improve-prompt/route.ts` — item 3 (NEW, 501 stub)
- `apps/web/app/api/me/preferences/route.ts` — item 6 (NEW)
- `apps/web/lib/hooks/use-user-preferences.ts` — item 6 (NEW)
- `apps/web/lib/stores/preferences-store.ts` — item 6 (NEW)
- `apps/web/app/globals.css` — item 6 (revert :root to light, keep .dark unchanged so theme switching works)
- `packages/db/src/schema.ts` — items 2 and 6 (runs.title + users.preferences columns)
- `apps/worker/src/jobs/generate-run-title.ts` — item 2 (NEW worker job)
- `apps/agent-hub/...` (verify) — only if title-gen worker enqueues from a different layer

### Convention references
- Phase 4 D-02 — runs.title was removed historically; planner must verify whether the column still exists or needs re-adding.
- Phase 6 — Composer.tsx already has the verbosity slider and `@`-mention; Improve button must NOT regress those.
- Phase 11 — RunViewTabs URL-sync pattern; default tab now sourced from preferences.
- Phase 12-01 — `:root` was overridden to dark; this phase reverts that change and uses `<html className="dark">` plus theme switching instead.

### Existing patterns to mirror
- BullMQ jobs: see existing `apps/worker/src/jobs/` for the queue setup and pattern.
- TanStack Query hooks: see `apps/web/lib/hooks/use-run.ts` and `use-run-history.ts`.
- Auth-scoped API routes: see `apps/web/app/api/runs/[id]/route.ts` (Plan 12-04) for `requireTenantContext()` pattern.
- LiteLLM calls: search the agent-hub for the LiteLLM HTTP wrapper currently used for cost extraction.

</canonical_refs>

<specifics>
## Specific Ideas

- The run history page currently shows `prompt` truncated to 80 chars. After item 2 lands, that column shows `title ?? prompt`. Header label changes from "Prompt" to "Title". The same column renders the same info, just shorter and prettier when title is generated.
- Title generation is best-effort. UI must always work even if the title never arrives — this is why the fallback to `truncate(prompt, 80)` is mandatory.
- For item 7 Boardroom, sentinel events stay filtered out in Clean mode (preserving Phase 11 behavior).
- Theme=auto reads `window.matchMedia('(prefers-color-scheme: dark)')` and listens for changes. Don't hardcode it.
- The improve-prompt button should NOT be a primary affordance — it's secondary to Send. Use a ghost-style button with a Sparkles icon, no fill. Send stays primary.

</specifics>

<deferred>
## Deferred Ideas

- Backfilling `runs.title` for existing runs (separate one-shot job).
- "Regenerate title" affordance.
- Per-tenant theme overrides (today is per-user only).
- Settings page sections beyond the four prefs (e.g., notification routing, MFA management UI within settings).
- A real Boardroom export (e.g., "download as columnar PDF").
- Timeline keyboard shortcuts (space to play/pause, left/right to scrub by event).
- OpenClaw upgrade on Jarvis to support model `claude-opus-4-7` — operational task, not in this phase.

</deferred>

---

*Phase: 13-ui-polish-round-2-and-tabs-redesign*
*Context gathered: 2026-04-27 from Lucas's verbal post-Phase-12 UAT*
