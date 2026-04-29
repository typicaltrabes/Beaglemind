# Phase 18 — UX First-Class Pass

**Status:** EXECUTING (started 2026-04-29 14:50 ET, target: 17:50 ET / 3-hour budget)
**Driver:** Lucas wants console.beaglemind.ai elevated to first-class customer-facing UX before next demo. Walked through the full app via Playwright, surfaced 30+ findings ranked C/H/M/L.
**Audience for fixes:** External customers — family offices, real-estate, medical (per project memory). Not internal-only test users.

## Source of truth

Findings come from a 2026-04-29 Playwright UX walkthrough (this session). The report covered:
- Landing + project dashboard
- /runs Run History page
- Run page (Writers' Room, Timeline, Boardroom, Canvas)
- Clean vs Studio toggle
- Settings, Shared Links, Questions
- Share Replay flow
- Mobile viewport (390×844)
- Sidebar agent-click filter

Screenshots saved to `~/Projects/beagle-console/.playwright-mcp/ux-*.png` (1–16).

## Plan numbering

Plans are ordered by impact-first severity. Each plan is self-contained — partial completion of phase 18 ships value at every stop point.

| # | Title | Severity | Est. | Notes |
|---|---|---|---|---|
| 18-01 | MinIO public URL — fix broken image attachments | 🔴 C1 | 30m | Presigned URLs hardcode internal Docker hostname; mixed-content blocked |
| 18-02 | Share Replay — finish modal implementation | 🔴 C2 | 30m | Modal opens but contains zero functional UI (no link, no copy, no generate) |
| 18-03 | Project dashboard parity with /runs | 🔴 C3 | 30m | Customer-facing landing has worse view of same data — port KPI strip + table |
| 18-04 | Trust-signal cluster | 🟠 H1+H2+H3+H4+H10+M3 | 30m | Presence semantics, hide Sam/LiteLLM/Grafana from non-operators, capitalize agent IDs in filter pills, distinct failure-bubble styling |
| 18-05 | Run-page polish | 🟠 H5+H6+H8+H9+M2 | 30m | Timeline tooltip event-type leak; Boardroom column hygiene; cancelled-cost tooltip; dashboard prompt truncation; state_transition as divider not paragraph |
| 18-06 | Composer + per-message interactions | 🟡 M4+M6+M7 | 30m | Reply/copy/regenerate hover actions; better composer placeholder; paperclip on dashboard composer |
| 18-07 | Mobile + relative-time polish | 🟡 M11+M12+M1 | 20m | Mobile bubble overflow; mobile header truncation; relative timestamps on dashboard cards |

**Plans 18-08 onward are deferred** — recorded in `18-DEFERRED.md` for later phases:
- Settings expansion (M8/M9), theme cleanup (M13)
- Executive Summary export (L6) — Lucas's external-feedback memo flagged this as headline differentiation
- Empty-state CTAs, cancelled-run cleanup, favorites (L3/L4/L5)
- Keyboard shortcuts, scroll-to-top, Fork/Branch implementation (L1/L2/L8)

## Stop points

- After 18-01: image attachments work for users (huge unlock)
- After 18-02: replay-share is no longer a broken-on-click feature
- After 18-03: customer landing finally feels first-class
- After 18-04: app stops whispering "internal tool" via Sam/LiteLLM/Grafana exposure
- After 18-05: visual polish on the most-trafficked screen (run page)
- After 18-06: keyboard-natural interactions on every message
- After 18-07: mobile parity

If we stop at any plan boundary, ROADMAP.md flags remaining work as ready-to-pick-up. The deferred plans live in `18-DEFERRED.md` with enough context to plan from cold.

## Decisions

- **Don't introduce new infra dependencies.** All fixes within current Next.js + Tailwind + shadcn + agent-hub stack.
- **Don't break existing tests.** All changes accompanied by test updates if applicable.
- **Each plan = atomic git commit + atomic deploy.** No multi-plan rollups. Atomic-commits preserve revert granularity.
- **Skip per-plan UAT.** Deploy after each plan; smoke-check via Playwright at end. Full UAT batched at phase end (or deferred to user when back at the office).
- **Mo's LiteLLM rate-limit (locked until 2026-05-01) is unrelated** — affects text-only Mo turns; vision turns route around it. Don't try to "fix" it within this phase.

## Architecture references

- Frontend: `apps/web/app/(dashboard)/...` Next.js 15 RSC + client components, Tailwind, shadcn
- Composer + transcript components: `apps/web/components/transcript/*`, `apps/web/components/run-views/*`
- API routes: `apps/web/app/api/**/route.ts`
- Tenant DB: `tenant_eb61fa6a_..._artifacts` (Hanseatic)
- MinIO: container `beagle-console-minio-1`, exposed via Caddy. Bucket convention `tenant-${tenantId}`
- Deploy: push → ssh beaglehq → /tmp/beagle-build → docker build → docker compose up -d --force-recreate

## Out of scope for Phase 18

- Mo offline troubleshooting (handled in 17.1-08; LiteLLM rate-limit is Henrik's budget cap, not our bug)
- OpenClaw vision pass-through plumbing (already shipped 17.1-09)
- New feature work — Phase 18 is strictly polish + close existing gaps
- Backend performance / cost tuning
- Authentication / multi-tenant work

## How to resume mid-phase

If Lucas closes the laptop mid-flight, the next conversation should:
1. Read `.planning/STATE.md` — `stopped_at` will name the last completed plan
2. Read this file (`18-CONTEXT.md`) for phase-level context
3. Read the next plan's `18-NN-PLAN.md` and pick up at its `<tasks>` section
4. Read `18-DEFERRED.md` if all numbered plans are done
