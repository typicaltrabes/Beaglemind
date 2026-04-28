# Phase 17: User Attachments — Documents & Images to Agents — Context

**Gathered:** 2026-04-27 (evening, end of long session)
**Status:** Ready for planning
**Source:** Lucas's call-out at the end of the Phase 16 UAT pass: "we need a way to upload documents and pictures etc to the agents."

<domain>
## Phase Boundary

Let users attach files to a prompt so agents can read/see them and respond about them. Three sub-tracks:

**Track 1 — Composer upload UI.**
Add a paperclip button + drag-drop zone to the in-run composer (`apps/web/components/transcript/composer.tsx`). Sits between the Improve (Sparkles) button and Send. Drag-drop highlights the entire composer area on dragover. Validates client-side: PDF / DOCX / PNG / JPG / WEBP / TXT / MD, max 20 MB per file, max 4 files per message. Shows a small chip stack above the textarea for each pending attachment with a remove (×) button per chip. Pending attachments are uploaded immediately to a server-side staging endpoint and the chip flips from "uploading…" → "ready" before the user can hit Send.

**Track 2 — Storage + extraction backend.**
- New `POST /api/runs/[id]/attachments` endpoint, multipart form-data, auth-scoped to current tenant + run. Validates type/size, generates a UUID key, uploads to existing MinIO bucket `tenant-${tenantId}` under `runs/${runId}/uploads/${key}.${ext}`, inserts a row in `artifacts` table with `agent_id='user'`. Returns `{ artifactId, filename, mimeType, sizeBytes }`.
- New `apps/web/lib/extract-attachment.ts` text-extraction module (server-only): PDF → `pdf-parse`, DOCX → `mammoth` (both already in repo per Phase 7), TXT/MD → utf-8 read, PNG/JPG/WEBP → return `null` (let the vision-capable agent see the image directly via base64). Cap extracted text at 50K chars per file with truncation marker.
- Persist extracted text on a new `artifacts.extracted_text` TEXT column (idempotent migration: `ADD COLUMN IF NOT EXISTS`).

**Track 3 — Agent context delivery.**
When `POST /api/runs/[id]/messages` fires the round-table, look up any `artifacts` rows for this run that are `agent_id='user'` AND created after the last user message. For each, append a structured block to the round-table prompt BEFORE the agents are sent the message:

```
--- USER ATTACHMENTS ---
[1] filename.pdf (PDF, 142 KB)
<extracted text or "(image — see attached)">
[2] screenshot.png (PNG, 38 KB)
(image — included with this message)
--- END ATTACHMENTS ---
```

For images: when the agent-hub CLI bridge sends the message to OpenClaw, include the image bytes as base64 in the message payload (OpenClaw's `chat.send` already supports image content blocks per `OpenClawOutbound` schema). Mo and Jarvis (Anthropic Opus) and Herman (open-weight, may or may not support vision) get the same payload — Herman will skip image blocks his model can't parse.

**What this phase does NOT do:**
- Per-agent file targeting (e.g., "send this only to Jarvis"). All attachments go to the round-table prompt that every agent sees.
- Audio / video uploads.
- Persistent file libraries across runs (uploaded files belong to the run that received them).
- Inline preview of the user's PDF/DOCX upload in the transcript (artifact card already renders mime + filename + download; the existing `ArtifactCard` covers this surface).
- LLM-driven OCR / handwriting transcription of images. We pass the image as-is and let the vision model read what it can.
- File deletion / management UI (out of scope; user can revoke a share link if they need to scrub).

</domain>

<decisions>
## Implementation Decisions

### Track 1 — Composer UI
- **Composer state:** `attachments: PendingAttachment[]` where `PendingAttachment = { localId: string; file: File; status: 'uploading' | 'ready' | 'error'; artifactId?: string; error?: string }`. Local-only state, not in Zustand.
- **Paperclip placement:** between Improve and Send buttons, ghost-style icon button. Use `Paperclip` from lucide-react.
- **Drag-drop zone:** the entire composer outer container gets `onDragOver`/`onDragLeave`/`onDrop` handlers. On dragover, add `ring-2 ring-amber-500/50` to make the drop target obvious. Drop = same file-handling path as paperclip click.
- **Validation:** reject silently with a toast-style inline error if mime not in allowed set or size > 20MB. Allowed: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/markdown`.
- **Upload flow:** on file selection, immediately POST each to `/api/runs/${runId}/attachments` (multipart, one file per request). Update chip status as response returns.
- **Send blocking:** Send button disabled while any attachment is `uploading`. On Send, the message body posts as JSON with `{ content: string, attachmentIds: string[] }` to the existing `POST /api/runs/[id]/messages`. The message-route handler reads attachments from DB and builds the round-table prompt.
- **Chip styling:** `inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-xs`. Filename truncated at 24 chars + size + remove ×. Per-chip status icon (spinner / check / alert).

### Track 2 — Storage + extraction
- **Migration:** new `packages/db/src/scripts/migrate-17.ts` script following the same pattern as `migrate-13.ts` (which we fixed in Phase 14 to read from `shared.organizations` not `shared.tenants`). Adds `extracted_text TEXT` to every `tenant_<id>.artifacts` table. Idempotent. Run during deploy plan.
- **Schema update:** add `extractedText: text('extracted_text')` to the `artifacts` Drizzle schema.
- **Endpoint:** `POST /api/runs/[id]/attachments`. Auth via `requireTenantContext()`. Reads multipart via Next 15's `request.formData()`. Validates with Zod. Generates UUID for `minio_key`. Streams the file to MinIO using existing `getMinioClient()` from `lib/minio.ts` (Phase 7).
- **Extraction:** runs synchronously in the request handler (small files, <20MB, sync OK for V1). For PDF: `pdf-parse` from existing dep. For DOCX: `mammoth.extractRawText`. For TXT/MD: `await file.text()`. For images: skip extraction, store NULL.
- **Cap:** extracted text > 50,000 chars → truncate to 50,000 + `\n\n[... truncated, original ${size} bytes ...]`.
- **Response shape:** `{ artifactId: string, filename: string, mimeType: string, sizeBytes: number }`.
- **Failure modes:** size/mime rejection → 400 with reason. Extraction failure → log warning, store NULL extracted_text (still upload the file successfully — the user can still download it; agents just won't see text).

### Track 3 — Agent context delivery
- **Message route change:** `apps/web/app/api/runs/[id]/messages/route.ts` now accepts `attachmentIds: string[]` (defaulted to `[]`, validated as UUIDs, max 4). Before calling `hubClient.startRun(...)`, fetches the artifact rows by id, builds the attachment block, and prepends it to the prompt. Image artifacts include base64-encoded bytes so the hub can pass them through.
- **Hub change:** `apps/agent-hub/src/http/routes.ts` round-table handler accepts an optional `attachments: Array<{filename, mimeType, sizeBytes, extractedText, base64?: string}>` field on the start-run payload. When building the per-agent prompt, prepend a structured `--- USER ATTACHMENTS ---` block BEFORE the user prompt (not after, so the agent reads context before instruction). For images, the OpenClaw CLI bridge call passes the image as part of the message — this requires extending the CLI bridge to accept image blocks. Defer images-via-CLI-bridge if it's complex; ship text extraction first and add image support second-pass.
- **Image fallback:** if image-via-CLI-bridge proves complex, ship a textual placeholder `(image attached: ${filename} — vision-pass not yet wired)` so the run still works end-to-end and the user knows the limitation.

### Cross-cutting
- **Single deploy at end of phase**, same workflow as Phase 12/13/14/16.
- **Atomic commits per track** — `feat(17-NN):` scope.
- **Tests:** unit tests for the extraction helper (pdf/docx/txt/image-skip), zod validation tests for the endpoint. Skip integration tests; verify by manual UAT (upload a PDF + image to a fresh run, confirm agents reference content).
- **No new top-level npm dependencies** — `pdf-parse` and `mammoth` are already in the repo (Phase 7).
- **Migration ordering:** schema migration runs FIRST in the deploy plan, before container rebuild.
- **Pre-flight:** typecheck + vitest before deploy (now standard).

### Claude's Discretion
- Specific Tailwind classes for chip states.
- Whether to use the existing `lucide-react` `Paperclip` or a custom SVG.
- Whether image base64 lives in the message payload or a separate field.
- Whether to add a small "X attachments" counter on the chip stack.
- Whether to extract a shared `<AttachmentChip />` or inline the JSX (suggestion: extract — used in both pending and history surfaces).
- Whether the upload endpoint streams or buffers the file (suggestion: buffer for V1 — simpler, files ≤20MB).
- Time budget for the image-via-CLI-bridge work: if it exceeds 30 min during execution, ship the text-only path and log image-send-via-base64 as a Phase 18 follow-up.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Files this phase will touch
- `apps/web/components/transcript/composer.tsx` — Track 1 (paperclip + drag-drop + chip stack)
- `apps/web/components/transcript/attachment-chip.tsx` — Track 1 (NEW)
- `apps/web/lib/attachment-upload.ts` — Track 1 (NEW client helper)
- `apps/web/app/api/runs/[id]/attachments/route.ts` — Track 2 (NEW endpoint)
- `apps/web/lib/extract-attachment.ts` — Track 2 (NEW server module)
- `apps/web/lib/extract-attachment.test.ts` — Track 2 (NEW)
- `packages/db/src/schema/tenant.ts` — Track 2 (add `extractedText` column to `artifacts`)
- `packages/db/src/scripts/migrate-17.ts` — Track 2 (NEW migration script)
- `apps/web/app/api/runs/[id]/messages/route.ts` — Track 3 (accept `attachmentIds`, build attachment block, pass to hub)
- `apps/agent-hub/src/http/routes.ts` — Track 3 (round-table accepts attachments, prepends to per-agent prompt)
- `apps/agent-hub/src/connections/openclaw-cli-bridge.ts` — Track 3 (image base64 forward — DEFER if complex)
- `packages/shared/src/hub-events.ts` — Track 3 (extend start-run payload schema with optional `attachments` field)

### Existing patterns to mirror
- MinIO client: `apps/web/lib/minio.ts` (Phase 7) — already configured with creds, just call `getMinioClient()`.
- Migration script pattern: `packages/db/src/scripts/migrate-13.ts` post-Phase-14 fix — iterates `shared.organizations`, per-tenant try/catch, idempotent.
- Multipart in Next 15: `await request.formData()` then `formData.get('file') as File`.
- `pdf-parse` and `mammoth` usage: `apps/web/app/api/artifacts/[id]/preview/route.ts` (Phase 7).

### Conventions
- Tailwind tokens consistent with prior phases (`text-foreground`, `border-white/10`, amber accent for active states).
- `lucide-react` for all icons.
- Drizzle `text()` column type for `extractedText`.
- All new endpoints have a brief `<threat_model>` block in their plan addressing: auth-scope (tenant + run-ownership), input validation (Zod for body, mime + size for files), DoS (max 4 files/req, 20MB each, in-handler rate-limit at 10 req/min/user).

### Tests to add
- `extract-attachment.test.ts` — pdf, docx, txt, md, png-skip, jpeg-skip, oversized truncation, malformed-pdf graceful failure.
- `attachment-chip.test.tsx` (optional) — visual states.

</canonical_refs>

<specifics>
## Specific Ideas

- The chip stack is the primary UX hint that "the agent will see this." Make it visually clear the file is attached AND extracted-text-ready.
- `(image — included with this message)` is the right phrasing for the agent prompt block. Don't lie about extraction.
- For the image-via-CLI-bridge work, look at how OpenClaw's `OpenClawOutbound.chat.send` schema handles content blocks today (per `packages/shared/src/hub-events.ts`). If it's already an array of typed blocks, drop image blocks in. If it's plain string, the image work needs a CLI bridge extension and that's the deferred bit.
- Prefer to ship the text-extraction path WITH MinIO upload + artifact row creation even if image-vision is deferred — half-shipped is better than nothing because text is the 80% case.
- Existing `artifact_create` event mechanism (Plan 13-06) means uploaded files automatically appear in the Canvas tab's artifact list once we insert the event. Reuse that path.

</specifics>

<deferred>
## Carryover for Phase 18 (queued 2026-04-27 evening, ranked by Lucas)

### CRITICAL — must ship in Phase 18

- **1:1 agent chat is crucial.** Promoted from "deferred Phase 16 item" to top priority. Click an agent in the sidebar (or via per-message Reply button) → opens a direct chat thread with just that agent. Run kind = `agent_chat`, scoped to one `agentId`, no round-table. New entry-points: (a) sidebar AgentRow gets a primary "Chat" action alongside the current "Filter Run History" behaviour — likely split the row into two click zones or add an explicit chat icon, (b) per-message Reply button on every transcript bubble (WhatsApp-style) that prefills composer with the quoted message and routes the next reply to that specific agent. Both routes converge on the same backend: a new run kind, a new prompt-build path in the hub that sends to ONE agent only, and a UI mode that shows just that agent's voice + your replies. Lucas explicitly called this out as crucial — make it the headline of Phase 18.

- **Sam not seeing console traffic — governance gap.** Sam is configured as the Sentinel observer but the Beagle Console round-table was deliberately built to exclude him (commit `dc80d91 fix: exclude Sam from visible agents (sentinel only), keep Mo/Jarvis/Herman`). The problem: that exclusion ALSO meant Sam never receives the transcript, so he can't score drift / behaviour / governance signals on console activity. He's only observing WhatsApp. For governance to work end-to-end, Sam needs to read EVERY console run as a passive observer (no speaking turn, but full transcript visibility). Implementation: after each round-table cycle completes, the hub forks a side-call to Sam with the full transcript + agent responses, marked `mode: passive_observe`. Sam emits `sentinel_flag` events on whatever he flags (these already render in the Process drawer). No new event type needed; reuse the existing sentinel infrastructure from Phase 9. Architecturally: one extra hub call per round-table, fire-and-forget, never blocks user-visible flow.

### High priority — Phase 18 if budget allows

- **Sidebar should stay on screen while content scrolls.** Today the sidebar (AGENTS roster + PROJECTS list + nav-icon row) scrolls along with the main content area, so when you click into a project and scroll down through earlier runs the sidebar disappears off the top. Fix: add `sticky top-0 h-screen overflow-y-auto` (or `fixed` positioning with proper main-content offset) to the sidebar wrapper in `apps/web/components/sidebar/sidebar.tsx`. Likely 5-minute CSS fix; verify against the existing mobile drawer behaviour (don't break that). Quick win — could be the first item in Phase 18 to ship before the bigger 1:1-chat / Sam-governance work.

- **Logo too small in header.** Lucas's call-out 2026-04-27 evening: the current 56×56 logo at `apps/web/public/brand/logo.jpg` reads as cramped. The source artwork is 1408×756 (wide aspect) — squeezing it into a square thumbnail loses the deco beagle detail. Options for tomorrow: (a) re-export just the shield/beagle portion of the artwork without the baked-in "BEAGLE AGENT CONSOLE" wordmark text (since the header text already says "Beagle Agent Console"), then display at ~64×64 cropped tight; (b) keep the full artwork but display wider — e.g., 120×64 with `object-contain` so the full logo + wordmark inside the image is legible (and drop the redundant header text in that case); (c) commission/generate a header-optimised square version of the logo. Lucas isn't sure which direction yet — needs eyes-on tomorrow with options A/B mocked side-by-side. **Reminder explicitly requested: bring this up first thing tomorrow.**

- **Per-message Reply button (WhatsApp-style).** General-purpose feature, NOT a 1:1-chat mechanism — works in every chat type (group round-table AND 1:1). Highest value is in group chats where threads pile up and the user needs to respond to a specific point Mo or Jarvis made 5 messages back without losing context. Every agent message in the transcript gets a Reply affordance. On click: (a) scrolls composer into view, (b) prefills with quoted preview (`> Mo: <first 80 chars>...`), (c) on send, the message body includes the quoted reference so receiving agents know which prior turn the user is responding to. In group chats, the round-table proceeds as normal but every agent now has explicit context about which earlier message the user is calling out. In 1:1 chats, behaves the same way against the single agent.

- **Light theme is broken.** Phase 13-05 reverted `:root` to light shadcn defaults but never QA'd light mode. When `theme=light` is selected in Settings, surfaces render with bad contrast / missing borders / inconsistent token coverage. Decide between (a) properly QA every component against light tokens, OR (b) remove `light` from Settings theme options and ship dark-only. Audit first, then commit.

- **Timeline rethink.** Phase 13-06's scrub bar + Phase 16's pace fix made it functional but it doesn't earn its tab today. Either (a) redesign as proper run replay (per-agent horizontal lanes, message-length bars instead of equal dots, scene labels inline, scrubber that snaps to scene boundaries), OR (b) demote it from a top-level tab to an opt-in "Replay this run" overlay launched from Writers' Room. Audit first.

- **Clean vs Studio differentiation is too weak.** Make Clean truly distraction-free (hide cost row + UUID slug, larger type, narrower content column, scenes aggressively collapsed) and Studio truly power-user dense (full metadata, sentinel scoreboard always visible, fork/branch panel surfaced, live token-counter per agent). The toggle should produce a visibly different layout at a glance, not a hidden-feature switch.

## Deferred Ideas

- Per-agent file targeting (route a file only to Jarvis, etc.)
- Audio / video / spreadsheet uploads
- File library across runs (e.g., "Send this PDF to all future Jarvis runs")
- LLM-driven OCR for handwritten notes
- Embedding-based search across all uploaded files (vector memory integration)
- Inline file preview in the composer (today: chip + remove only)
- Per-tenant storage quotas / billing meter

</deferred>

---

*Phase: 17-attachments*
*Context gathered: 2026-04-27 from Lucas's end-of-session ask*
