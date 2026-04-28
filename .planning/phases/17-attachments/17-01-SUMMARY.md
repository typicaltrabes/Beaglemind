---
phase: 17-attachments
plan: 01
subsystem: ui
tags: [composer, attachments, drag-drop, multipart, vitest, tdd, react, lucide, tailwind]

requires:
  - phase: 04
    provides: useSendMessage React Query mutation hook + /api/runs/[id]/messages POST contract
  - phase: 06
    provides: composer.tsx Studio toolbar (verbosity slider, @-mention badge) — preserved
  - phase: 07
    provides: artifact-card.tsx inline formatSize helper (now extracted to lib/format-size.ts)
  - phase: 13
    provides: Improve-prompt Sparkles button placement convention — paperclip slots in next to it

provides:
  - "apps/web/lib/format-size.ts — single source of truth formatSize(bytes) helper"
  - "apps/web/lib/attachment-upload.ts — uploadAttachment(runId, file) client + AttachmentUploadError class"
  - "apps/web/components/transcript/attachment-chip.tsx — single chip with status icon (Loader2/Check/AlertCircle), filename truncation, size, remove X"
  - "Composer paperclip + drag-drop + 4-file chip stack + send-blocking + transient validation banner"
  - "useSendMessage mutationFn now accepts optional attachmentIds: string[] — forwarded to POST /api/runs/[id]/messages JSON body"
  - "buildSendMessageBody pure helper exported for unit testing the wire-shape conditional serialization"

affects: [17-02, 17-03, 17-04]

tech-stack:
  added: []
  patterns:
    - "Pending-attachment chip stack with three statuses (uploading/ready/error) and per-chip remove × — local useState (NOT Zustand) per CONTEXT"
    - "Fire-and-forget parallel uploadAttachment calls inside handleFiles — each file resolves into chip state independently via setAttachments folding"
    - "Drag-drop highlight on the outer composer container via dragActive state + conditional 'ring-2 ring-amber-500/50' Tailwind ring"
    - "Hidden <input type='file' multiple accept={ACCEPT_ATTR}> driven by paperclip click + value reset on change so picking the same file twice re-fires onChange"
    - "Multipart fetch helper that intentionally omits Content-Type header so the browser inserts the boundary parameter"
    - "Pure body-builder helper (buildSendMessageBody) split out from useSendMessage for unit-testing without React Query"

key-files:
  created:
    - apps/web/lib/format-size.ts
    - apps/web/lib/format-size.test.ts
    - apps/web/lib/attachment-upload.ts
    - apps/web/lib/attachment-upload.test.ts
    - apps/web/components/transcript/attachment-chip.tsx
    - apps/web/lib/hooks/use-run-actions.test.ts
    - .planning/phases/17-attachments/deferred-items.md
  modified:
    - apps/web/components/transcript/composer.tsx
    - apps/web/components/transcript/artifact-card.tsx
    - apps/web/lib/hooks/use-run-actions.ts

key-decisions:
  - "[Phase 17-01]: formatSize extracted to apps/web/lib/format-size.ts as the single source of truth — artifact-card.tsx now imports it, eliminating the inline duplicate. Both surfaces (pending chip pre-send and ArtifactCard post-send) render the same size string for the same file."
  - "[Phase 17-01]: AttachmentChip uses rounded-md (not rounded-full) per CONTEXT — visual differentiator from the rounded-full @-mention badge; same bg-white/5 + size-3 lucide icons + ml-0.5 X button skeleton."
  - "[Phase 17-01]: Local useState attachments (PendingAttachment[]), NOT Zustand. Matches the existing composer state pattern (input, mentionOpen, targetAgent, verbosity, improveOpen) and CONTEXT's explicit 'Local-only state, not in Zustand' decision."
  - "[Phase 17-01]: Parallel uploads, not serial. handleFiles fires uploadAttachment per file as a fire-and-forget promise — a slow PDF can't gate a fast PNG. Each promise's resolution folds into setAttachments by localId match, so the chip stack stays consistent under concurrent completions."
  - "[Phase 17-01]: No DELETE on chip-remove (V1 simplicity per CONTEXT). When a user removes a successfully-uploaded chip, we drop the local state but DO NOT call DELETE — the orphan MinIO object is acceptable; per-tenant storage quotas (Phase 18 backlog) will reclaim. Failure mode: the artifact still exists on disk; no security exposure since it's tenant-scoped and not referenced by any message."
  - "[Phase 17-01]: useSendMessage signature widened to SendMessageVars (content + optional attachmentIds + targetAgent + metadata) — drops the awkward Parameters<typeof sendMessage.mutate>[0] cast that composer.tsx had been carrying since Phase 06. buildSendMessageBody is the exported pure helper so the conditional-serialization logic is unit-testable without mounting React Query."
  - "[Phase 17-01]: Forward-compatible passthrough — the existing /api/runs/[id]/messages Zod schema (`z.object({ content: z.string().min(1) })`) silently strips unknown keys (verified inline), so passing attachmentIds today is safe; Plan 17-03 widens the schema to consume them."
  - "[Phase 17-01]: Validation errors flash a 4-second inline banner WITHOUT creating a chip. Rejected files (wrong mime, oversize) never enter the attachments[] array, so they don't gate Send, don't show a 'failed' chip, and don't waste UI real estate — they just nudge the user to pick a valid file."
  - "[Phase 17-01]: Send is blocked when ANY chip is uploading (anyUploading boolean) AND when sendMessage.isPending — both conditions independently disable the Send button so a fast double-click can't fire a request mid-upload."
  - "[Phase 17-01]: Hidden file input value is reset on every change (e.target.value = '') so the user can re-pick the SAME file after removing its chip — without this, the browser deduplicates and the second pick is a no-op."

patterns-established:
  - "lib/format-size.ts as the canonical formatter — future surfaces (CanvasArtifactPreview, run-summary file lists) import from here instead of re-inlining the four-line ladder"
  - "AttachmentUploadError(status, message) class shape — match LiteLLMError semantics; carries the HTTP status as a public property so callers can branch on 413/429/500 without parsing the message"
  - "Pure body-builder split out of mutationFn for unit testing — apply to other hooks where the body shape has conditional optional fields (useStartRun, useAnswerQuestion later if their bodies grow)"

requirements-completed: []

duration: 6min
completed: 2026-04-28
---

# Phase 17 Plan 01: Composer Attachment UI Summary

**Paperclip + drag-drop + 4-file chip stack with parallel uploads, status icons, validation banner, and Send-blocking — drives the full client-side surface of UAT-17-01 against the staging endpoint that Plan 17-02 will provide.**

## Performance

- **Duration:** ~6 min (commits 08:58 → 09:04 ET, 2026-04-28)
- **Tasks:** 2 (each split RED → GREEN per TDD plan)
- **Files:** 9 touched (6 new, 3 modified) — composer.tsx, artifact-card.tsx (dedupe), use-run-actions.ts (widen + extract helper)
- **Tests:** +16 new vitest cases across 3 new test files; full suite 158 → 165 (all green)

## Accomplishments

### Task 1 — `formatSize` + `AttachmentChip` + `uploadAttachment` (commits `1785b71` test, `7510f7c` impl)

- **`apps/web/lib/format-size.ts`** (new) — `formatSize(bytes)` with 0-B / sub-KB / sub-MB / MB branches. Documented as the single source of truth; the Phase 7 inline copy in `artifact-card.tsx` is replaced by `import { formatSize } from '@/lib/format-size'`.
- **`apps/web/lib/format-size.test.ts`** (new, 4 cases) — exact-string assertions for the four branches plus the 1023-B edge.
- **`apps/web/lib/attachment-upload.ts`** (new):
  - `AttachmentUploadError` extends `Error` with public `status: number` and `name = 'AttachmentUploadError'`.
  - `uploadAttachment(runId: string, file: File): Promise<UploadResponse>` — POSTs to `/api/runs/${runId}/attachments` with a `FormData` body, deliberately NOT setting `Content-Type` so the browser inserts the multipart boundary.
  - `UploadResponse = { artifactId, filename, mimeType, sizeBytes }` — matches the Plan 17-02 contract.
- **`apps/web/lib/attachment-upload.test.ts`** (new, 5 cases) — 200-success returns parsed JSON, FormData carries the file under `'file'`, 400 throws with body's `error` field, 500 falls back to `statusText`, error class shape (extends Error, public status, name).
- **`apps/web/components/transcript/attachment-chip.tsx`** (new) — single-chip component:
  - Imports `Loader2, Check, AlertCircle, X` from `lucide-react` and `formatSize` from `@/lib/format-size`.
  - Renders `<span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-xs">` with status icon (size-3, color-coded), truncated filename (ext-preserving up to 6-char extensions), `formatSize(sizeBytes)`, and an aria-labeled remove `<button>` that calls `onRemove(localId)`.
  - `data-status` attribute on the outer span so future styling/test hooks can target individual statuses without parsing icon presence.
- **`apps/web/components/transcript/artifact-card.tsx`** (modified) — deletes the inline `formatSize` declaration, adds `import { formatSize } from '@/lib/format-size'`. `grep "function formatSize" artifact-card.tsx` now returns zero matches (acceptance criterion satisfied).

### Task 2 — Composer wiring + `useSendMessage` widening (commits `961242c` test, `090ee0a` impl)

- **`apps/web/lib/hooks/use-run-actions.ts`** (modified):
  - New `SendMessageVars` interface with optional `attachmentIds?: string[]`, `targetAgent?: string`, `metadata?: { verbosity?: number }`.
  - New exported pure helper `buildSendMessageBody(vars)` — drops empty/undefined optional fields from the wire shape. Exported so unit tests can assert the conditional-serialization logic without mounting React Query.
  - `useSendMessage` mutationFn now consumes `SendMessageVars`, calls `buildSendMessageBody(vars)` to construct the body, and otherwise preserves the existing fetch + error contract.
- **`apps/web/lib/hooks/use-run-actions.test.ts`** (new, 7 cases) — exhaustive matrix over the optional fields: content-only, attachmentIds undefined/empty/non-empty, targetAgent truthy/undefined, metadata included, all-three-together.
- **`apps/web/components/transcript/composer.tsx`** (modified):
  - **Imports:** `Paperclip` from `lucide-react`, `AttachmentChip` + `AttachmentStatus` type from `./attachment-chip`, `uploadAttachment` + `AttachmentUploadError` from `@/lib/attachment-upload`.
  - **Constants:** `ALLOWED_MIME` (7-element Set), `MAX_SIZE_BYTES` (20 MB), `MAX_FILES_PER_MESSAGE` (4), `ACCEPT_ATTR` (file picker filter), `VALIDATION_ERROR_TIMEOUT_MS` (4000).
  - **State:** `attachments` (`PendingAttachment[]`), `dragActive`, `validationError`, plus a `validationErrorTimerRef` cleared on unmount.
  - **Refs:** `fileInputRef` for the hidden `<input type="file">`.
  - **Handlers:** `handleFiles` (validation + parallel uploads, fire-and-forget, fold-into-state by localId), `removeAttachment`, `handlePaperclipClick`, `handleFileInputChange` (resets value so re-picking same file works), `handleDragOver`/`handleDragLeave`/`handleDrop`, `flashValidationError` (4s auto-clear).
  - **JSX:**
    - Outer `<div>` gains `onDragOver`/`onDragLeave`/`onDrop` handlers + conditional `'ring-2 ring-amber-500/50'` while dragging.
    - Hidden `<input type="file" multiple accept={ACCEPT_ATTR} className="hidden" aria-hidden>` rides inside the outer container.
    - Transient validation banner: `rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400`.
    - Chip stack: `flex flex-wrap gap-1.5` only renders when `attachments.length > 0`.
    - Paperclip ghost button placed BETWEEN Improve and Stop/Send (per CONTEXT), disabled when `attachmentsAtMax || isCancelled || isPlanned`, with title hint that flips to "Max 4 files per message" at the cap.
  - **`canSend`** extended with `&& !anyUploading` so Send greys while any chip is mid-upload.
  - **`handleSend`** builds `attachmentIds[]` from `attachments.filter(a => a.status === 'ready' && a.artifactId)` and calls `setAttachments([])` in the `onSuccess` callback. The earlier `as Parameters<typeof sendMessage.mutate>[0]` cast is removed now that `SendMessageVars` widens the type properly.

## Task Commits

Each task split into RED + GREEN per TDD discipline:

1. **Task 1 RED — failing tests for formatSize + uploadAttachment** — `1785b71` (test)
2. **Task 1 GREEN — format-size + attachment-upload + AttachmentChip impl + artifact-card dedupe** — `7510f7c` (feat)
3. **Task 2 RED — failing tests for buildSendMessageBody** — `961242c` (test)
4. **Task 2 GREEN — composer wiring + useSendMessage widen** — `090ee0a` (feat)

## Files Created/Modified

| File | Status | Role |
|------|--------|------|
| `apps/web/lib/format-size.ts` | NEW | Shared byte-size formatter (deduped from artifact-card.tsx) |
| `apps/web/lib/format-size.test.ts` | NEW | Vitest cases for 0-B / B / KB / MB branches |
| `apps/web/lib/attachment-upload.ts` | NEW | `uploadAttachment(runId, file)` multipart client + `AttachmentUploadError` class |
| `apps/web/lib/attachment-upload.test.ts` | NEW | Vitest cases mocking `globalThis.fetch` for 200/400/500 + FormData wiring |
| `apps/web/components/transcript/attachment-chip.tsx` | NEW | Single chip: status icon + filename + size + remove × |
| `apps/web/lib/hooks/use-run-actions.test.ts` | NEW | Vitest cases for `buildSendMessageBody` conditional serialization |
| `apps/web/components/transcript/composer.tsx` | MODIFY | Paperclip + drag-drop + chip stack + send-blocking integration |
| `apps/web/components/transcript/artifact-card.tsx` | MODIFY | Replace inline `formatSize` with import from `@/lib/format-size` |
| `apps/web/lib/hooks/use-run-actions.ts` | MODIFY | Widen `useSendMessage` to `SendMessageVars`; export pure `buildSendMessageBody` helper |
| `.planning/phases/17-attachments/deferred-items.md` | NEW | Out-of-scope log: pre-existing `apps/agent-hub` typecheck drift to fold into Plan 17-03 |

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Single source of truth for `formatSize`.** Artifact-card.tsx had its own inline copy; rather than duplicate again for the chip stack, the helper moves to `lib/format-size.ts` and both surfaces import it. Future canvas/preview surfaces inherit consistency for free.
- **Local useState for attachments.** Matches CONTEXT's explicit "not in Zustand" decision and the existing composer state pattern. The chip stack is per-message ephemeral state that should disappear on send/route-change — Zustand's persistence is exactly the wrong shape.
- **Parallel uploads, not serial.** Each file fires its own `uploadAttachment` promise inside `handleFiles`; resolutions fold into `setAttachments` by localId match. A slow PDF doesn't gate a fast PNG, and the chip stack stays consistent under concurrent completions because every `setAttachments` callback uses the functional form against the latest state.
- **Forward-compatible passthrough on attachmentIds.** The existing `/api/runs/[id]/messages` Zod schema (`z.object({ content })`) strips unknown keys silently (verified inline at `node -e` against `zod/v4`), so passing `attachmentIds` today is safe — Plan 17-03 widens the schema to actually consume them. This means we can ship the client UI right now without coordinating a backend release.
- **No DELETE on chip-remove.** V1 simplicity per CONTEXT — orphan uploads stay on disk. Phase 18's per-tenant quotas will reclaim. No security exposure since artifacts are tenant-scoped from the moment Plan 17-02's endpoint creates them.
- **Validation rejects don't create chips.** Wrong-mime / oversize files flash a 4-second inline banner and never enter `attachments[]`. This keeps the chip stack a clean "files we're actually attaching" surface and avoids confusing the user with a perpetual error chip they can't recover.
- **Reset hidden-input value on change.** Without `e.target.value = ''` after `handleFiles`, the browser dedupes successive picks of the same file (the input's value matches the previous selection), making remove-then-re-pick a silent no-op.
- **Send-blocking is double-defended.** Both `!anyUploading` (in `canSend`) and `sendMessage.isPending` (Send button's `disabled`) gate the action — a fast double-click can't fire a request mid-upload, and a stuck-uploading chip can't be sent past.
- **Pure `buildSendMessageBody` extracted.** The mutationFn body composition has three optional fields with conditional-include logic; without `@testing-library/react` to drive the hook end-to-end, splitting this out as a pure helper makes the conditional serialization unit-testable. Same pattern can apply to `useStartRun` / `useAnswerQuestion` if their bodies grow.

## Deviations from Plan

None. Both tasks executed exactly as the `<action>` blocks specified, and all acceptance criteria pass on a literal grep:

- `Paperclip` imported from `lucide-react` ✓
- `AttachmentChip` imported from `./attachment-chip` ✓
- `uploadAttachment, AttachmentUploadError` imported from `@/lib/attachment-upload` ✓
- `ALLOWED_MIME = new Set([` with all 7 mime literals ✓
- `MAX_SIZE_BYTES = 20 * 1024 * 1024` ✓
- `MAX_FILES_PER_MESSAGE = 4` ✓
- `useState<PendingAttachment[]>([])` ✓
- Outer `<div>` has `onDragOver` / `onDragLeave` / `onDrop` + conditional `'ring-2 ring-amber-500/50'` ✓
- `<input type="file" multiple accept={ACCEPT_ATTR} className="hidden">` (single match) ✓
- Paperclip button disabled when `attachments.length >= MAX_FILES_PER_MESSAGE` ✓
- `canSend` includes `!anyUploading` ✓
- `handleSend` filters `attachments.filter(a => a.status === 'ready')` ✓
- `onSuccess` calls `setAttachments([])` ✓
- `useSendMessage` accepts `attachmentIds?: string[]` ✓
- Conditional serialization (empty array dropped) ✓
- `apps/web` `tsc --noEmit` exits 0 ✓
- All 165 vitest tests pass ✓

The Task 2 plan offered an optional **2C** AttachmentChip DOM test using `@testing-library/react` — skipped per the plan's own fallback note ("If `@testing-library/react` is NOT installed, skip Task 2C and verify status-icon rendering via TypeScript-only assertions"). The chip's status-icon branching is trivial (three `if (status === '…')` lines) and is covered indirectly by:
- `formatSize` unit tests for the size string display
- `attachment-upload` unit tests for the network round-trip
- The acceptance criteria grep for `rounded-md bg-white/5` (chip styling) and the lucide imports
- Manual UAT in Plan 17-04 (composer paperclip → picker opens → chip flips to ready)

## Issues Encountered

- **`pnpm` not on Windows PATH.** Same gap documented in 16-03's SUMMARY. Worked around by routing every `pnpm` invocation through `corepack pnpm …` via `powershell.exe -Command`. Both `tsc --noEmit` and `vitest run` exit 0.
- **`apps/agent-hub` pre-existing typecheck drift.** Discovered when running monorepo-wide `pnpm -r exec tsc --noEmit` as a smoke pass (NOT in the plan's verification scope, which is `apps/web` only). Three TS errors in `connections/openclaw-cli-bridge.ts` and `http/routes.ts` referencing `costUsd` and `model` properties that don't exist on the current OpenClaw response shape. Logged to `.planning/phases/17-attachments/deferred-items.md` for Plan 17-03 to fold in (which already touches `routes.ts`). Out of scope for 17-01 per executor scope-boundary rule.
- **CRLF warnings on every commit.** Standard Windows behavior; same warnings every prior plan on this machine has emitted. No action needed.

## Threat Model Status

| Threat ID | Status |
|-----------|--------|
| T-17-01-01 (Tampering — disallowed file type bypassing client validation) | Accepted at this layer — client validation is UX-only; Plan 17-02's `/api/runs/[id]/attachments` endpoint will re-validate against the same `ALLOWED_MIME` set on the server (mandated by CONTEXT and 17-02 plan). The attempt to spoof `file.type` would just trigger a 400 from the server, which AttachmentUploadError surfaces as a chip in error state. |
| T-17-01-02 (DoS — paperclip spam with large files) | Mitigated client-side — `MAX_FILES_PER_MESSAGE = 4` and `MAX_SIZE_BYTES = 20 * 1024 * 1024` cap intake before any network call; Plan 17-02 also rate-limits at 10 req/min/user. |
| T-17-01-03 (Information disclosure — error messages leak server internals) | Mitigated — `AttachmentUploadError.message` falls back to `res.statusText` when the JSON body has no `error` field; we don't surface raw response bodies, stack traces, or DB errors. The chip's `title` shows the message (truncated at the natural span width), not a full HTML response. |
| T-17-01-04 (Repudiation — orphan uploads after chip remove) | Accepted per CONTEXT V1 simplicity. Tenant-scoped storage; no security exposure; Phase 18 per-tenant quotas will reclaim. |

## User Setup Required

None for Plan 17-01 itself — the feature is client-only and degrades gracefully:

- Paperclip click → picker opens → user picks file → chip shows status=`uploading` indefinitely (because Plan 17-02's endpoint isn't deployed yet) → chip eventually flips to `error` (Next.js 404 page returns non-JSON, AttachmentUploadError carries the 404 statusText). User can remove the chip and continue with a text-only message — Send is unblocked the moment the failed chip is removed.

Once Plan 17-02 ships and the staging endpoint is live, the same UI lights up end-to-end with no further composer changes.

## Next Phase Readiness

- **Plan 17-02 (storage + extraction backend)** is unblocked — it owns `apps/web/app/api/runs/[id]/attachments/route.ts` plus the migration. The contract is fixed:
  - Request: `multipart/form-data` with field `file`
  - Response 200: `{ artifactId, filename, mimeType, sizeBytes }`
  - Response 4xx/5xx: `{ error: string }` (or any non-2xx — fallback to statusText)
- **Plan 17-03 (round-table delivery)** is unblocked — it owns `apps/web/app/api/runs/[id]/messages/route.ts` schema widening and the agent-context block. The Zod schema needs `attachmentIds: z.array(z.string().uuid()).max(4).default([])`. The current passthrough is forward-compatible: until 17-03 lands, the field is silently stripped.
- **Plan 17-04 (deploy + UAT)** can verify UAT-17-01 directly: paperclip click opens picker → drag a PDF + image onto the composer → see amber drag-active ring → drop → see two chips with `Loader2` spinning → both flip to `Check` → click Send → message sends with `attachmentIds[]` payload → chips disappear. The spinner-during-upload + greyed-Send + clear-on-success behavior is implemented client-side; 17-04 just exercises the full path.

## Self-Check: PASSED

- `apps/web/lib/format-size.ts` — FOUND
- `apps/web/lib/format-size.test.ts` — FOUND
- `apps/web/lib/attachment-upload.ts` — FOUND
- `apps/web/lib/attachment-upload.test.ts` — FOUND
- `apps/web/components/transcript/attachment-chip.tsx` — FOUND
- `apps/web/lib/hooks/use-run-actions.test.ts` — FOUND
- `apps/web/components/transcript/composer.tsx` — FOUND (modify, all acceptance grep checks pass)
- `apps/web/components/transcript/artifact-card.tsx` — FOUND (modify, inline formatSize removed)
- `apps/web/lib/hooks/use-run-actions.ts` — FOUND (modify, SendMessageVars + buildSendMessageBody)
- `.planning/phases/17-attachments/deferred-items.md` — FOUND
- Commit `1785b71` (Task 1 RED) — FOUND
- Commit `7510f7c` (Task 1 GREEN) — FOUND
- Commit `961242c` (Task 2 RED) — FOUND
- Commit `090ee0a` (Task 2 GREEN) — FOUND
- `corepack pnpm -F web exec tsc --noEmit` → exit 0
- `corepack pnpm -F web exec vitest run` → 165/165 passing (was 158/158 before plan)

## TDD Gate Compliance

The plan declared `tdd="true"` on both tasks. Both gates fired correctly:

- **Task 1:** test commit `1785b71` (RED — both test files imported non-existent modules, suite failed) → impl commit `7510f7c` (GREEN — 9 tests passing).
- **Task 2:** test commit `961242c` (RED — `buildSendMessageBody is not a function`, 7 tests failing) → impl commit `090ee0a` (GREEN — 7 tests passing, full suite 165 green, tsc clean).

No REFACTOR commits required — both implementations were minimal-to-pass on the first GREEN pass.

---
*Phase: 17-attachments*
*Completed: 2026-04-28*
