# Phase 8: Replay & Sharing - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the replay share-link system: tokenized URLs that let external viewers watch a Clean-mode-only replay of any completed run. Links are revocable, time-boxed, audit-logged, with server-side content filtering.

This is the marketing flywheel — a pilot customer shares a great investigation, the colleague watches agents think.

</domain>

<decisions>
## Implementation Decisions

### Share Link Generation
- **D-01:** User clicks "Share replay" on a completed run → system generates a tokenized URL: `console.beaglemind.ai/replay/{token}`.
- **D-02:** Token is a random 32-byte hex string stored in a share_links table in the tenant schema. Fields: id, run_id, token (unique), created_by, expires_at, revoked_at, created_at.
- **D-03:** Default expiry: 30 days. Configurable per tenant (tenant settings table or env var).

### Replay Rendering
- **D-04:** Replay route is a public Next.js page (no auth required). Loads events from DB via the token, renders read-only Writers' Room transcript.
- **D-05:** Content filtering is SERVER-SIDE: the replay API endpoint returns only Clean-mode events. No sentinel data, no process drawer data, no Studio-only signals. Filter applied at query level, not client-side hiding.
- **D-06:** External viewer sees: agent names, scene headers, plan approval card, question/answer pairs, artifacts (download links), messages. Does NOT see: sentinel flags, cost data, fork info, verbosity settings.
- **D-07:** Replay page is read-only: no composer, no approve/reject buttons, no answer inputs. Just the transcript.

### Link Management
- **D-08:** Tenant admin can revoke any share link from a "Shared links" management page.
- **D-09:** Revoked or expired links show a "This replay has expired" page.
- **D-10:** Every replay view is logged: viewer IP, user-agent, timestamp, token used. Logged to a replay_views table in tenant schema.

### Audit
- **D-11:** Tenant admin can see replay view logs: who viewed, when, from where. Accessible from the run page or shared links management page.

### Claude's Discretion
- Replay page styling (reuse existing transcript components)
- Share dialog UX (copy link, QR code, etc.)
- Rate limiting on replay views (per-IP)
- Replay view log retention policy

</decisions>

<canonical_refs>
## Canonical References

### Design Document
- Design Doc v3 §10.6 — Replay share-link rules, what external viewers see/don't see

### Existing Code
- `apps/web/components/transcript/message-list.tsx` — Reuse for replay rendering (read-only mode)
- `apps/web/app/api/runs/[id]/stream/route.ts` — Event loading pattern (adapt for replay)
- `packages/db/src/schema/tenant.ts` — Add share_links + replay_views tables

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- MessageList with scenes, collapse, TLDR (Phase 5) — render in read-only mode for replay
- Agent avatars, scene dividers, message components — all reusable
- Event loading from DB pattern (SSE endpoint)

### Integration Points
- New public route: /replay/[token] (outside dashboard layout, no auth)
- New API: GET /api/replay/[token]/events (filtered events)
- Share links table in tenant schema
- Share button on completed run pages
- Admin page for link management

</code_context>

<specifics>
## Specific Ideas

- The replay page should have minimal chrome — just the transcript with a "Powered by Beagle Agent Console" footer
- Share dialog should have a "Copy link" button that copies to clipboard with a confirmation toast

</specifics>

<deferred>
## Deferred Ideas

- Auth-walled share links (external viewer needs passphrase) — v2
- QR code generation for share links — v2

</deferred>

---

*Phase: 08-replay-sharing*
*Context gathered: 2026-04-21*
