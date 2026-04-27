# Phase 16: Visual Overhaul — "Stop Looking Basic" — Context

**Gathered:** 2026-04-27 (late afternoon, same day as Phase 12-15)
**Status:** Ready for planning
**Source:** Lucas's feedback after Phase 15 deploy, plus two reference screenshots from sister BeagleMind sites: Sonic Care Nordverbund "Agenten Zentrale" (BeagleHQ ops dashboard) and Mo OpenClaw Agent (chat UI). The current console reads as default-shadcn / generic-dark — sister sites read as branded, dense, polished.

<domain>
## Phase Boundary

Five visual overhaul tracks, all to ship today:

**Track 1 — Header / branding upgrade.**
The Phase 15 logo + "Beagle Agent Console" header is a half-step. Match the sister-site pattern: bold-italic typography ("Beagle Agent *Console*" with the italicized accent word in amber), dense vertical rhythm, breadcrumb on dashboard pages, agent-aware pulse dot showing live system status (any agents currently producing events). Add external-tool links to LiteLLM + Grafana (the same `litellm.beaglemind.ai` + `hq.beaglemind.ai` links the BeagleHQ ops dashboard exposes), gated behind operator role.

**Track 2 — Sidebar redesign — Mo-style.**
Today's sidebar is a thin column with `PROJECTS / Run History / Shared Links / QUESTIONS`. Replace with a denser two-section layout:
- **Top:** Agent roster — Mo, Jarvis, Herman, Sam — each as a row with avatar + name + role + colored pulse dot for live status (`presence: ready / busy / offline`). Click an agent row to filter Run History to runs that involved that agent.
- **Bottom:** Project list (BeagleLabs is the only one today) collapsed by default, expandable to show recent runs under each project. Same threaded-conversation pattern Mo's UI uses.
- Plus existing Run History / Shared Links / Questions / Settings as compact icon-row at the very bottom.

**Track 3 — Run History chrome upgrade.**
Top of `/runs` gets a 4-card KPI strip: Total Runs / Total Spend / Avg Cost per Run / Completed Today. Each card is a compact panel with a value + sub-label (matching the "AGENTEN GESAMT 5" pattern from the Sonic Care reference). Below the strip, the existing table with one density bump: row hover reveals a "View" affordance, status chips get rounded-pill styling consistent with sister sites.

**Track 4 — Agent perspective tags in speaker chips.**
Per Lucas's external-feedback memo earlier today: "Mo · Governance" / "Jarvis · Commercial Risk" / "Herman · Stress-Test" instead of just "Mo · workflow lead". This is a one-line config change in `apps/web/lib/agent-config.ts` (rename `role` strings) — but it's the single most-impactful brand differentiation per the feedback. Bundle into this phase.

**Track 5 — Run page header polish.**
Run page today shows: title (h1) → status chip + UUID slug + Stop/Share buttons → tabs. Improve to:
- Italicized accent word ("Run *Replay*" or just keep title but add a project breadcrumb above)
- Status chip + UUID + cost summary on a single secondary metadata row (smaller text, tabular)
- Tab strip gets the rounded-pill styling matching the rest of the system

**What this phase does NOT do:**
- Restructure dashboard routing (no new top-level pages beyond what exists).
- Replace shadcn/base-ui primitive layer (still using existing primitives, just composing them better).
- Touch the agent SOUL.md or any backend conversation logic — speaker-chip role-string change is config-only.
- Build the agent-pulse-dot LIVE-presence backend (Track 2's pulse dots use a derived signal from "any event from this agent in the last 60s" already in run-store; no new SSE event type or DB table).
- Quick-action buttons on the composer (Force Consensus / Stress Test) — that's Phase 17 alongside conflict-marker work.
- Light-theme verification of any new components — dark-mode is the visible default; light tokens carry over from shadcn defaults but aren't QA'd this phase.

</domain>

<decisions>
## Implementation Decisions

### Track 1 — Header

- **Wordmark:** swap the current `<span>Beagle <span class="font-light text-amber-400">Agent Console</span></span>` for a bolder treatment: `Beagle Agent <em class="not-italic font-bold text-amber-400">Console</em>` rendered with `tracking-tight font-semibold text-[18px]`. The accent word stays amber but bolds up to match Sonic Care's "Agenten *Zentrale*" weighting.
- **Logo:** keep `/brand/logo-removebg-preview.png` already shipped in Phase 15. Bump from 32px → 36px and add a subtle `ring-1 ring-amber-500/20 ring-offset-0` for separation from the dark bg.
- **System pulse dot:** add a 6px pulse dot before the wordmark that's `bg-emerald-500 animate-pulse` when any run has events streaming in the last 60s, otherwise `bg-gray-500` static. Read from `useRunStore` — if `eventOrder.length > 0` and `Date.now() - latestEventTimestamp < 60_000`, mark live. Pure-derived, no backend change.
- **External-tool links** (top-right, before ModeToggle): two text links `LiteLLM ↗` and `Grafana ↗` with `text-xs text-muted-foreground hover:text-foreground` styling and external-link icons. Only render for `is_operator=true` users (existing operator flag from Phase 9). Hrefs: `https://litellm.beaglemind.ai`, `https://hq.beaglemind.ai`.
- **Breadcrumb (dashboard pages only, not run pages):** thin row below header showing `BEAGLELABS › DASHBOARD` (uppercase, `text-[10px] tracking-wider text-muted-foreground`) — extracted into `<Breadcrumb />` component so different routes can pass their own crumbs. Run page does NOT show a breadcrumb (run page already has a title row that serves the same purpose).

### Track 2 — Sidebar

- **Component:** rewrite `apps/web/components/sidebar/sidebar.tsx` to render three sections in this order:
  1. **AGENTS** — header label + 4 rows (mo / jarvis / herman / sam). Each row: `AgentAvatar` (24px) + display name (semibold, `nameColor`) + role (`text-[11px] text-muted-foreground`) + presence dot (12px, right-justified, animated when live). Clicking a row navigates to `/runs?agent=<id>` (filter param) — Run History reads it and filters server-side to runs whose events include that agent.
  2. **PROJECTS** — existing project list (BeagleLabs) but collapsed: just the project name, click expands to show last 5 runs inline. Reuse existing `<ProjectList />` but wrap in a `<Collapsible>` from base-ui.
  3. **NAV ICONS** — bottom row, single line of icon buttons: Run History (`History` icon), Shared Links (`Share2`), Questions (`HelpCircle`, with badge if pending count > 0), Settings (`Settings`). Icons only at `text-muted-foreground hover:text-foreground`, with tooltip on hover showing the label.
- **Presence signal source:** `useRunStore.events` already has all events. Compute `agentLastSeenMs[agentId]` per render, mark "live" if last seen <60s, "ready" if last seen <30min, "offline" otherwise. Pure-derived.
- **Run History agent filter:** extend the existing `GET /api/runs/history` to accept `?agent=<id>` query param. Filter where `EXISTS (SELECT 1 FROM events WHERE events.run_id = runs.id AND events.agent_id = ?)`. UI passes the param through.

### Track 3 — Run History KPI strip

- **Endpoint:** new `GET /api/runs/history/summary` returning `{ totalRuns, totalSpendUsd, avgCostUsd, completedToday }`. Auth-scoped to current tenant. Single Drizzle query with `count(*)`, `sum(events.cost_usd metadata)`, `avg(...)`, and a date filter for today. Read cost from event metadata since runs table doesn't have a cost column (per current schema).
- **Component:** new `<RunHistorySummary />` at the top of `/runs`. CSS-grid 4 columns (1 column on mobile). Each tile:
  - Top row: tile name in `text-[10px] uppercase tracking-wider text-muted-foreground` plus an inline icon (lucide: Activity / DollarSign / TrendingUp / CheckCircle2)
  - Big number: `text-2xl font-semibold tabular-nums text-foreground`
  - Sub-label: `text-[11px] text-muted-foreground` (e.g., "Last 7 days", "Mo: $0.32 · Jarvis: $0.81")
- **Loading state:** skeleton bars per tile while the summary endpoint loads (don't block the table below).
- **Status chips:** existing `STATUS_VARIANT` map gets a `rounded-full` (currently default rounded-md). One-line change.
- **Row hover:** add `group/row` to each `<tr>`, show a `<ChevronRight className="opacity-0 group-hover/row:opacity-100" />` in the rightmost column. No new column header needed — slot it after the date.

### Track 4 — Agent role rebranding

In `apps/web/lib/agent-config.ts`:

| agent   | old role               | new role             |
| ------- | ---------------------- | -------------------- |
| mo      | `workflow lead`        | `Governance`         |
| jarvis  | `research analyst`     | `Commercial Risk`    |
| herman  | `open-weight researcher` | `Stress-Test`      |
| sam     | `sentinel`             | `Sentinel`           |
| user    | `''`                   | `''` (unchanged)     |

Verbatim values, capitalized. Updates everywhere `getAgentConfig(...).role` is read (speaker chips, sidebar agent rows, cost section, interrupt button). No code changes needed beyond the config map — all consumers already read `.role`.

### Track 5 — Run page header

- **Wordmark on run page** stays simple — h1 of `run.title || truncate(prompt, 80)` (Phase 13-03 work). Add italic-accent treatment ONLY in the dashboard chrome (Track 1), not the run page title which is user content.
- **Metadata row:** rebuild as a single row of `tabular-nums text-[11px] text-muted-foreground` items separated by `·`:
  ```
  [STATUS-CHIP] · #5c6304af · 2m 18s · $6.46 · 3 agents · 6 events · 3h ago
  ```
  Sourced from `useRun()` (Phase 13-01) + `useRunStore` derived counts.
- **Action buttons** (Stop / Share) move to the right of the metadata row, ghost-style with icons only and a tooltip on hover (saving horizontal space).
- **Tab strip:** existing `RunViewTabs` keeps its values but the tab list itself gets `rounded-full bg-white/5 p-1` wrapping with each tab as `rounded-full px-3 py-1.5` and the active tab `bg-amber-500/15 text-amber-400`. This matches the sister-site pill pattern and the existing Clean/Studio toggle styling.

### Cross-cutting

- **No DB schema changes.** Track 3's summary endpoint reads from existing tables. Track 2's presence is pure-derived. Track 4 is config.
- **No new npm dependencies.** Reuse what's already in `apps/web/package.json` (lucide-react, base-ui, shadcn primitives).
- **Single deploy at end of phase.**
- **Atomic commits per track** — `feat(16-NN):` scope with N matching the track number above.
- **Tests:** unit-test pure helpers if any are introduced (e.g., a `computePresence(events, agentId, now)` helper). Skip integration tests (purely visual changes).
- **Mobile (<768px):** all tracks must remain usable on phone. KPI strip collapses to 1-column, sidebar uses the existing mobile-drawer pattern from Phase 10. Header stays single-line; external-tool links hide on mobile.

### Claude's Discretion

- Exact hex / Tailwind tokens for new accent treatments — pick from the existing palette (`amber-400`, `amber-500`, `emerald-500`, `white/10`, `muted-foreground`).
- Whether to extract a shared `<KpiCard />` for Track 3 (suggestion: yes, since 4 tiles repeat).
- Whether the agent-row click-to-filter behavior animates the URL change or hard-replaces (suggestion: hard-replace, simpler).
- Whether to render presence dots on the speaker chips themselves in addition to the sidebar (suggestion: skip — keep speaker chips as-is, presence lives in sidebar).
- Tile content for Track 3 (concrete suggestion: Total Runs `12` "Last 7 days" / Total Spend `$24.67` "Mo: $X · Jarvis: $Y" / Avg Cost `$2.05` "Per completed run" / Completed Today `2` "Out of 3 attempts").
- Whether Track 1's pulse dot animates on first render or waits for actual signal (suggestion: only animate when there's a real live event in the last 60s; static gray otherwise so it doesn't fake activity).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Files this phase will touch
- `apps/web/app/(dashboard)/dashboard-shell.tsx` — Track 1 header
- `apps/web/components/breadcrumb.tsx` — Track 1 (NEW)
- `apps/web/components/sidebar/sidebar.tsx` — Track 2 (rewrite)
- `apps/web/components/sidebar/agent-row.tsx` — Track 2 (NEW)
- `apps/web/components/sidebar/project-list.tsx` — Track 2 (modify, add Collapsible wrapper)
- `apps/web/lib/presence.ts` — Track 2 (NEW pure helper + tests)
- `apps/web/app/(dashboard)/runs/page.tsx` — Track 3 (add `<RunHistorySummary />`, pass `agent` filter param)
- `apps/web/components/runs/run-history-summary.tsx` — Track 3 (NEW)
- `apps/web/components/runs/kpi-card.tsx` — Track 3 (NEW)
- `apps/web/components/runs/run-history-table.tsx` — Track 3 (rounded chip + hover affordance)
- `apps/web/app/api/runs/history/summary/route.ts` — Track 3 (NEW endpoint)
- `apps/web/app/api/runs/history/route.ts` — Track 2 (extend with `?agent=` filter)
- `apps/web/lib/hooks/use-run-history-summary.ts` — Track 3 (NEW)
- `apps/web/lib/hooks/use-run-history.ts` — Track 2 (accept agent param)
- `apps/web/lib/agent-config.ts` — Track 4 (role string changes)
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — Track 5 metadata row + action buttons
- `apps/web/components/run-views/run-view-tabs.tsx` — Track 5 (pill styling)

### Conventions
- Tailwind v4 + shadcn-style tokens. Reuse `text-foreground` / `text-muted-foreground` / `border-white/10` consistent with Phase 12-13 chrome.
- Lucide-react for icons (already used widely).
- Base-ui Popover / Collapsible / Tooltip for primitives (already used).
- Operator-only UI elements: gate via existing `is_operator` flag from Better Auth org member.

### Patterns to mirror
- KPI tiles: see Sonic Care Nordverbund reference screenshot from this conversation — 4-column grid, label + big number + sub-label.
- Sidebar agent rows: see Mo OpenClaw screenshot from this conversation — avatar + name + status pulse dot.
- Pill-style tabs: see existing `<ModeToggle />` in `apps/web/components/mode-toggle.tsx` — same `rounded-full bg-white/5 p-1` pattern.

</canonical_refs>

<specifics>
## Specific Ideas

- The Mo screenshot's mint-green accent is *that product's* identity. Beagle Agent Console's accent stays amber (already in `--color-accent: #f7b733` per globals.css). Do not switch to mint.
- Sister sites use italic accent words for nominative differentiation: "Agenten *Zentrale*" / "Beagle *Mind*" / "Beagle *Love*". Apply this to "Beagle Agent *Console*" — it's the cheapest single-pixel signal that this is part of a network.
- Avoid adding new dependencies for charting in the KPI tiles. Plain numbers + sub-labels are enough for V1; sparklines and trend-arrows can be Phase 17.
- The presence helper should default to "offline" not "live" if an agent has no events at all — never show a fake live signal.
- The agent-filter URL param works on Run History only; it does NOT need to filter the agent roster itself in the sidebar (that's always all four agents).

</specifics>

<deferred>
## Deferred (Phase 16 UAT additions, 2026-04-27)

- **1:1 agent chat tab.** Clicking an agent in the sidebar today filters Run History to that agent's runs. Lucas wants click → opens a direct chat thread with just that agent (a new `kind: 'agent_chat'` run scoped to one agentId, no round-table). Substantial — requires new run-creation path, agent-targeted message routing in the hub, and a new sidebar UX that distinguishes "filter to agent" from "talk to agent." Real Phase 17+ feature.
- **Custom BeagleLabs logo.** Phase 16 used the BeagleLove silhouette as a placeholder. Lucas is preparing a BeagleLabs-specific logo file. Drop-in replacement at `/brand/logo-removebg-preview.png` once received.

## Deferred Ideas (Phase 17+ candidates from external feedback)

- Conflict / disagreement markers in transcript (needs an agent-side disagreement_with event in SOUL.md first)
- Confidence scores per agent message (needs calibration — not faking it)
- Quick-action buttons in composer (Force Consensus, Stress Test) — pairs with conflict markers
- Card-style formatting for agent-emitted numbered lists (markdown post-processor)
- Generate Executive Summary button (own phase — Phase 18)
- Living-document Canvas redesign (own phase, replaces current artifact-first model)
- Sparklines / trend arrows on KPI tiles
- Tenant theming so different orgs can override the amber accent

</deferred>

---

*Phase: 16-visual-overhaul*
*Context gathered: 2026-04-27 from Lucas's "make this look nicer" call-out + reference screenshots*
