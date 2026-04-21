# Phase 6: Clean & Studio Modes - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the Clean/Studio mode toggle to the console. Clean mode is the default — scenes collapsed, single Stop button, no power tools. Studio mode adds: process drawer, @-mention bar, verbosity dial, Interrupt agent button, fork button. Both modes render the same component tree with conditional visibility — NOT two separate trees.

</domain>

<decisions>
## Implementation Decisions

### Mode Toggle
- **D-01:** Toggle in the main header (pill-shaped toggle per wireframes: "Clean | Studio"). Persisted in user preferences (localStorage or DB).
- **D-02:** Clean is default for all users. No role-gating — every Year-1 user can toggle.
- **D-03:** Single React context provides current mode. Components read `useMode()` to conditionally render.

### Clean Mode (Default)
- **D-04:** Scenes collapsed (collapse folds from Phase 5 active). Single Stop button in composer. No @-mention, no verbosity dial, no fork button, no process drawer, no Interrupt button.
- **D-05:** Everything visible in Clean mode is also visible in Studio mode. Clean is a strict subset.

### Studio Mode
- **D-06:** Process drawer opens on the right side (320px per wireframes). Contains: sentinel data section, cost tracking, fork/branch info.
- **D-07:** @-mention bar in composer: typing @ shows agent list dropdown. Directs message to specific agent.
- **D-08:** Verbosity dial in composer: slider from "quiet" to "full" (per wireframes). Controls how much detail agents include in responses.
- **D-09:** Interrupt button: appears in header when an agent is in-flight. Red button "⏸ Interrupt [AgentName]". Sends interrupt signal to Hub for specific agent.
- **D-10:** Fork button in composer (⑂ icon): creates a branch from current run state. Deferred implementation (button visible, functionality in v2).
- **D-11:** Scenes expanded by default in Studio (override Phase 5's default-collapsed behavior).
- **D-12:** Sentinel pane in drawer shows sentinel flags, quality scores (data from Sam). Operator-role only visibility deferred to Phase 9.

### Process Drawer Content
- **D-13:** Drawer sections: Sentinel (last 30 min flags), Cost ($ consumed vs estimate), Fork/Branch (current branch, what-if branches).
- **D-14:** Drawer collapsible per section. Each section has its own expand/collapse.
- **D-15:** Cost data reads from LiteLLM metrics via the same run API. Sentinel data from events with type sentinel_flag.

### Claude's Discretion
- Mode toggle animation
- Drawer open/close animation
- @-mention dropdown styling
- Verbosity dial exact behavior (what values it sends to agents)
- Keyboard shortcuts for mode toggle

</decisions>

<canonical_refs>
## Canonical References

### Wireframes
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260415 Frontend Wireframes.html` — Clean mode (tab 1) vs Studio mode (tab 2): drawer, @-mention, verbosity, interrupt, sentinel pane

### Design Document
- `/Users/lucastraber/Library/CloudStorage/Dropbox-Hanseatic/Lucas Traber/F DRIVE/LTRABER/BeagleMind/20260417 Beagle Agent Console — Design Doc v3.md` — §7.1 two modes, §7.5 demo posture

### Existing Code
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` — Run page (add mode context + drawer)
- `apps/web/components/transcript/message-list.tsx` — MessageList (conditionally expand/collapse scenes)
- `apps/web/components/transcript/collapse-fold.tsx` — Collapse fold (respect mode)
- `apps/web/components/transcript/composer.tsx` — Composer (add @-mention, verbosity, fork in Studio)
- `apps/web/app/(dashboard)/layout.tsx` — Dashboard layout (add mode toggle to header)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Collapse fold + scene grouping (Phase 5)
- Composer component (Phase 4)
- Run page with Writers' Room (Phase 5)
- Dashboard layout with header (Phase 2/4)
- shadcn/ui components (Button, Input, Slider, Dialog, Popover)

### Integration Points
- Mode context wraps the dashboard layout
- Composer extends with @-mention, verbosity, fork
- MessageList reads mode to control default collapse state
- New Drawer component alongside main transcript area
- Header gets mode toggle pill

</code_context>

<specifics>
## Specific Ideas

- The mode toggle should look exactly like the wireframe: pill-shaped, Clean/Studio labels, active side highlighted in gold
- Process drawer matches wireframe: dark panel, section headers in uppercase, left-border accent colors on items
- Interrupt button: red border, red text, pause icon — matches wireframe "⏸ Interrupt Jarvis"

</specifics>

<deferred>
## Deferred Ideas

- Fork button functionality (v2 — button visible but shows "Coming soon" tooltip)
- Sentinel pane operator-role gating (Phase 9)

</deferred>

---

*Phase: 06-clean-studio-modes*
*Context gathered: 2026-04-21*
