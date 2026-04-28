---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 17-03-PLAN.md
last_updated: "2026-04-28T16:42:33.925Z"
last_activity: 2026-04-28 -- Phase 17.1 planning complete
progress:
  total_phases: 17
  completed_phases: 10
  total_plans: 65
  completed_plans: 46
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** Users can observe multi-agent reasoning in real time, steer it at governance gates, and share the full replay externally.
**Current focus:** Phase 17 — User Attachments

## Current Position

Phase: 17 (User Attachments) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-04-28 -- Phase 17.1 planning complete

Progress: [█████████░] 95%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: 7min
- Total execution time: 0.12 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 1/3 | 7min | 7min |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 02 P01 | 6min | 2 tasks | 11 files |
| Phase 02 P02 | 3min | 2 tasks | 9 files |
| Phase 02 P03 | 6min | 2 tasks | 9 files |
| Phase 03 P01 | 3min | 2 tasks | 14 files |
| Phase 03 P03 | 4min | 2 tasks | 11 files |
| Phase 04 P02 | 2min | 2 tasks | 3 files |
| Phase 04 P01 | 4min | 2 tasks | 26 files |
| Phase 04 P04 | 2min | 2 tasks | 6 files |
| Phase 04-research-sprint-workflow P03 | 3min | 2 tasks | 8 files |
| Phase 04-06 P06 | 3min | 2 tasks | 5 files |
| Phase 04-research-sprint-workflow P05 | 3min | 2 tasks | 8 files |
| Phase 05-transcript-ui P01 | 2min | 2 tasks | 6 files |
| Phase 05-transcript-ui P02 | 2min | 2 tasks | 3 files |
| Phase 05-transcript-ui P03 | 188s | 2 tasks | 3 files |
| Phase 06-clean-studio-modes P01 | 3min | 2 tasks | 6 files |
| Phase 06-clean-studio-modes P02 | 4min | 2 tasks | 7 files |
| Phase 07-artifacts-run-history P01 | 2min | 2 tasks | 4 files |
| Phase 07 P02 | 3min | 2 tasks | 6 files |
| Phase 08-replay-sharing P01 | 3min | 2 tasks | 5 files |
| Phase 08-replay-sharing P02 | 3min | 2 tasks | 4 files |
| Phase 08-replay-sharing P03 | 2min | 1 tasks | 5 files |
| Phase 09-operator-console-sentinel P01 | 3min | 2 tasks | 8 files |
| Phase 09-operator-console-sentinel P02 | 4min | 2 tasks | 11 files |
| Phase 09-operator-console-sentinel P03 | 4min | 2 tasks | 12 files |
| Phase 10-mobile-pwa P01 | 2min | 2 tasks | 6 files |
| Phase 10-mobile-pwa P02 | 6min | 2 tasks | 16 files |
| Phase 10-mobile-pwa P03 | 3min | 2 tasks | 7 files |
| Phase 11 P01 | 4min | 2 tasks | 8 files |
| Phase 11 P02 | 3min | 2 tasks | 4 files |
| Phase 11 P03 | 3min | 2 tasks | 4 files |
| Phase 11 P04 | 4min | 2 tasks | 6 files |
| Phase 12 P02 | 6min | 2 tasks | 2 files |
| Phase 12-ui-polish-from-phase-11-uat P03 | 2min | 2 tasks | 2 files |
| Phase 14 P01 | 6min | 2 tasks | 3 files |
| Phase 16-visual-overhaul P01 | 272 | 2 tasks | 9 files |
| Phase 16-visual-overhaul P03 | 3min | 2 tasks | 6 files |
| Phase 17-attachments P01 | 6min | 2 tasks | 10 files |
| Phase 17-attachments P02 | 9min | 2 tasks | 14 files |
| Phase 17-attachments P03 | 4min | 1 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

- Phase 11 added: Run-view tabs: Writers' Room, Timeline, Boardroom, Canvas
- Phase 12 added 2026-04-27: UI Polish from Phase 11 UAT (Track A — dark Run History, Writers' Room loading skeleton, speaker chips with full agent config, prompt-as-run-title). Track B (run lifecycle, artifact counts, status/cost mismatch) deferred to a separate phase.
- Phase 17.1 inserted after Phase 17 (URGENT, 2026-04-28): Vision pass-through — all agents see image content. Triggered by Phase 17 UAT: V1 placeholder reached agents but Lucas needs all agents (including future weaker LLMs) to engage with image content, not just see "(image attached)". 17.1 adds server-side vision-API description at upload + base64 bytes through CLI bridge for vision-capable agents.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Develop directly on BeagleHQ server (faster iteration, direct Postgres/Caddy access)
- Existing Postgres instance with new database, tenant isolation via schema not container
- pnpm workspaces monorepo (not Turborepo -- overkill for 3 apps)
- Used Zod v4 import path (zod/v4) for greenfield compatibility
- Added @types/node as root devDependency for Node.js types across all packages
- [Phase 02]: Removed .js import extensions in packages/db for webpack/Next.js transpilePackages compatibility
- [Phase 02]: Added zod as direct dep in apps/web for Better Auth type inference; disabled declaration emit in web tsconfig
- [Phase 02]: Fixed tsconfig @/* paths to single ./* mapping for correct alias resolution
- [Phase 02]: get-tenant.ts created in Task 1 (not Task 2) because dashboard layout imports requireTenantContext
- [Phase 02]: LogoutButton as separate client component to keep dashboard layout as server component
- [Phase 02]: Server-side auth.api.signUpEmail bypasses disableSignUp for invite acceptance and provisioning
- [Phase 02]: Direct DB insert for org/member in provisioning (no auth context available in CLI)
- [Phase 03]: zod/v4 z.record requires (key, value) args; added zod as direct dep in agent-hub for config validation
- [Phase 03]: Added drizzle-orm as direct dependency in agent-hub for sequence counter DB queries
- [Phase 04]: Extended OpenClawOutbound customData with catchall for additional fields (questionId)
- [Phase 04]: handleRunStart no longer publishes state_transition; Mo plan_proposal drives pending->planned lifecycle
- [Phase 04]: Removed title from runs table, replaced with projectId/kind/parentRunId/createdBy per D-02
- [Phase 04]: State machine uses lookup table pattern (not xstate) for simplicity and testability
- [Phase 04]: Hub client defaults to localhost:4100, overridable via AGENT_HUB_URL env var
- [Phase 04]: Used Record instead of Map for Zustand events store to avoid immer compatibility issues
- [Phase 04]: Added drizzle-orm, @aws-sdk/client-s3, s3-request-presigner as direct deps in apps/web for API route imports
- [Phase 04]: SSE endpoint uses dynamic import for ioredis to avoid Next.js bundling issues
- [Phase 04-06]: Agent color map: Mo=amber-500, Jarvis=teal-500, user=blue-400 for transcript messages
- [Phase 04]: Sidebar is client component in server layout; QueryProvider wraps entire layout children
- [Phase 04]: Dashboard page.tsx changed from server to client component using useProjects()
- [Phase 05-transcript-ui]: Scene grouping computed in deriveState for reactive updates; tldr_update excluded from messages array
- [Phase 05-transcript-ui]: CollapseFold uses renderEvent callback for parent-controlled expansion; detectCollapsibleRanges is pure function
- [Phase 05-transcript-ui]: Flat RenderItem union type (scene-divider|event|collapse-fold) as Virtuoso data model for heterogeneous list
- [Phase 05-transcript-ui]: Run page IS the Writers Room - minimal shell with header + TldrBanner + MessageList + Composer (D-18)
- [Phase 06-clean-studio-modes]: DashboardShell client component extracts client-side layout from server component layout.tsx
- [Phase 06-clean-studio-modes]: System message interrupt via existing /messages endpoint (Hub lacks dedicated /interrupt route)
- [Phase 07-artifacts-run-history]: Used @base-ui/react Dialog as slide-over panel instead of shadcn Sheet to match existing UI primitive pattern
- [Phase 07]: Drizzle SQL subqueries for artifact count and cost aggregation inline in SELECT
- [Phase 08-replay-sharing]: Used visual copied state on button instead of toast library (no sonner in project)
- [Phase 08-replay-sharing]: Tenant iteration for token lookup (O(tenants)) instead of public lookup table
- [Phase 08-replay-sharing]: Read-only plan/question cards inlined in ReplayMessageList to decouple from dashboard components
- [Phase 08-replay-sharing]: Expandable table row for audit log instead of dialog -- keeps context inline
- [Phase 09]: Operator role as boolean flag on users table (Year-1 simplicity)
- [Phase 09]: CLI provisioning creates standalone Better Auth instance (no Next.js deps)
- [Phase 09]: requireOperatorApi() returns null for API routes instead of redirecting (redirect throws NEXT_REDIRECT in catch blocks)
- [Phase 09-operator-console-sentinel]: Break-glass 4hr time-boxed access with server-side expiry enforcement
- [Phase 09-operator-console-sentinel]: Audit log visible to org owners/admins via Better Auth orgClient role check
- [Phase 10-mobile-pwa]: matchMedia JS listener for mobile detection to support backdrop click handlers
- [Phase 10-mobile-pwa]: Excluded sw.ts from main tsconfig (WebWorker types conflict with DOM)
- [Phase 10-mobile-pwa]: No FK on pushSubscriptions.userId to avoid circular import shared.ts<->auth-schema.ts
- [Phase 10-mobile-pwa]: Push trigger fire-and-forget from MessageRouter.persistAndPublish so push failures never break event pipeline
- [Phase 10-mobile-pwa]: Yes/no question detection via regex patterns plus content.type check for inline quick-answer
- [Phase 10-mobile-pwa]: lastActiveAt updated server-side after digest query (not on page load) for accurate activity window
- [Phase 11]: URL-synced tab switcher with canonical cleanup — default tab (writers-room) strips ?view= param; invalid values fall back silently without URL echo
- [Phase 11]: renderEvent extracted as pure function (not React component) from MessageList — single source of truth for transcript event rendering reused by Timeline/Boardroom
- [Phase 11]: Agent color palette (getAgentColor) kept separate from AGENT_CONFIG.bgColor — Timeline/Boardroom use tailwind palette classes (bg-amber-500), avatars keep branded hex (bg-[#f7b733])
- [Phase 11]: Timeline scene label strip placed above the 64px lane, not inside — keeps dots uncluttered and lets 24-char truncated labels render on their own row
- [Phase 11]: Timeline TooltipTrigger uses base-ui render-prop form so the dot <button> IS the trigger — single focusable absolutely-positioned element, no nested button
- [Phase 11]: Timeline scrubber snaps to nearest visible sequence via nearestEventBySeq; ties go to the LOWER seq (deterministic)
- [Phase 11]: Boardroom unconditional column sort — every column sorted ascending by sequenceNumber regardless of mode, so callers can rely on chronological order without doing their own sort (fix applied during Task 1 GREEN)
- [Phase 11]: Boardroom desktop/mobile split via tailwind hidden md:grid + md:hidden siblings, no matchMedia — SSR-safe, no hydration mismatch
- [Phase 11]: Boardroom run-level state_transition replication — studio mode pushes each transition into every agent column and re-sorts; clean mode filters them out upstream
- [Phase 11]: Canvas ArtifactPreviewInline extracted from ArtifactPreviewPanel — Dialog variant now composes the Inline child behind {open && ...} to preserve fetch-on-open; Canvas mounts the Inline child directly without Dialog chrome
- [Phase 11]: Canvas proximity comments use selectProximityComments — pure positional, filters to agent_message only, ties break to lower seq, default windowSize=5. No message-text parsing per CONTEXT.md
- [Phase 11]: PREVIEWABLE_MIMES exported from artifact-card.tsx as single source of truth — Canvas and ArtifactCard share one Set rather than duplicating the pdf+docx literal
- [Phase 12]: Add Herman + Sam to AGENT_CONFIG together (12-02) — single source-of-truth update lights up Avatar/Message/Cost surfaces with no consumer edits.
- [Phase 12]: Speaker chip uses regex transform `bg-[#hex]` → `bg-[#hex]/15` (chipBgClass helper, 12-02) — keeps to two files, no Tailwind plugin.
- [Phase 12-ui-polish-from-phase-11-uat]: [Phase 12]: WritersRoomSkeleton hardcodes mo/jarvis/herman id list with no run-store reads (12-03) — empty-state surface stays pure-derived from a single source-of-truth list paired with formatAgentList helper for the subtitle.
- [Phase 12-ui-polish-from-phase-11-uat]: [Phase 12]: Skeleton inlines a local SkeletonRow rather than rendering a fake AgentMessage (12-03) — avoids fabricating wire-format envelopes and keeps the empty-state surface decoupled from event rendering.
- [Phase 14]: 14-01: Extracted dbRowToEnvelope as a pure helper (apps/web/lib/sse-envelope.ts) — single source of truth for DB row → HubEventEnvelope mapping; fixes UAT-14-01 NaN:NaN timestamps by sending createdAt.toISOString() as timestamp
- [Phase 16-visual-overhaul]: [Phase 16-03]: KPI summary endpoint computes avgCostUsd = totalSpendUsd / completedRuns (sum-then-divide, one round-trip) rather than per-event AVG; matches user-facing tenant-level intuition.
- [Phase 16-visual-overhaul]: [Phase 16-03]: completedToday uses runs.updatedAt >= start-of-today UTC because runs has no completedAt column; phase 14-02 hub flips status+updatedAt at completion.
- [Phase 16-visual-overhaul]: [Phase 16-03]: KPI strip stays mounted with per-tile skeletons during fetch (not strip-level placeholder) so the table below renders independently.
- [Phase 17-attachments]: [Phase 17-01]: formatSize extracted to apps/web/lib/format-size.ts as single source of truth — artifact-card.tsx imports it, no inline duplicate
- [Phase 17-attachments]: [Phase 17-01]: useSendMessage widened to SendMessageVars (content + optional attachmentIds + targetAgent + metadata); pure buildSendMessageBody helper exported for unit-testing without React Query
- [Phase 17-attachments]: [Phase 17-01]: Composer attachments are local useState (NOT Zustand) per CONTEXT; parallel uploadAttachment per file, fire-and-forget, fold by localId
- [Phase 17-attachments]: [Phase 17-01]: AttachmentChip uses rounded-md (per CONTEXT) to differentiate from rounded-full @-mention badges; same bg-white/5 + size-3 lucide icon skeleton
- [Phase 17-attachments]: [Phase 17-01]: Forward-compatible passthrough — Zod v4 strips unknown keys silently, so passing attachmentIds through the pre-17-03 schema is safe (verified inline)
- [Phase 17-attachments]: [Phase 17-03]: Web-app-side prompt-prepend (Option A in PATTERNS.md) chosen — buildAttachmentBlock helper extracted to apps/web/lib/attachment-block.ts; hub schema unchanged (RunStartBody, OpenClawOutbound, openclaw-cli-bridge.ts all stable)
- [Phase 17-attachments]: [Phase 17-03]: Strict 404 ownership path — rows.length !== attachmentIds.length triggers { error: 'attachment not found' } 404; blocks cross-run reuse (T-17-03-02) and agent-output impersonation (T-17-03-03)
- [Phase 17-attachments]: [Phase 17-03]: Image base64 pass-through deferred — image attachments contribute textual placeholder '(image — included with this message)' for V1; OpenClaw CLI bridge image-block extension is a future-track effort
- [Phase 17-attachments]: [Phase 17-03]: ZodError → 400 branch added to messages route catch block — pre-17-03 the route caught only generic errors and returned 500; new attachmentIds validation requires the explicit branch for usable error messages

### Pending Todos

- **Re-verify UAT-13-02 + UAT-13-03 once LiteLLM is back.** Both items are code-complete; they reopen the moment LiteLLM (`sonic-hq-litellm-1`) starts responding. No code change needed — just retest a fresh run (title should auto-populate) and click the Improve button (popover should return a rewrite instead of "Internal server error").
- **Fix `migrate-13.ts` tenant lookup.** Script iterates `shared.tenants` (empty by convention in this project) instead of `shared.organizations` (the real source-of-truth). Worked around manually for the Hanseatic tenant during Phase 13 deploy, but the script will silently miss tenants on the next milestone. Single-line fix in `packages/db/src/scripts/migrate-13.ts`.
- **Track B from Phase 12 still open**: stuck `executing` runs in Run History (worker auto-complete not firing), `pending` chip on runs with non-zero cost (state-machine bug), `0` Artifacts column on every row (query or schema bug). Logged 2026-04-27, deferred to a future phase.
- **NaN:NaN timestamps in transcript** — pre-existing data-pipeline bug on `event.timestamp`, surfaced during Phase 12 UAT but flagged by Lucas as long-standing. Not Phase 12/13 regression.

### Blockers/Concerns

- **LiteLLM down on BeagleHQ (`sonic-hq-litellm-1`)** as of 2026-04-27. Container is in a Prisma-migrate restart loop, failing to authenticate against `postgres` with the credentials in `/opt/beaglehq/.env`. Likely drifted during the recent `beaglehq-* → sonic-hq-*` stack rename. Owned by Henrik. Blocks UAT-13-02 (run-title gen) and UAT-13-03 (Improve-prompt) at runtime; everything else continues to work because Jarvis was switched to direct-Anthropic auth this morning. Letter drafted, Lucas to send.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-04-28T13:31:03.852Z
Stopped at: Completed 17-03-PLAN.md
Resume file: None

**Planned Phase:** 11 (Run-view tabs: Writers' Room, Timeline, Boardroom, Canvas) — 5 plans — 2026-04-22T12:38:11.467Z
