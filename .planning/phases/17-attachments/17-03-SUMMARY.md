---
phase: 17-attachments
plan: 03
subsystem: api
tags: [attachments, prompt-prepend, drizzle, zod, vitest, tdd, hub-client, round-table]

requires:
  - phase: 04
    provides: hubClient.startRun({ runId, tenantId, prompt }) — unchanged signature; web app prepends the attachment block to `prompt` rather than passing structured attachments
  - phase: 17-01
    provides: composer-side attachmentIds[] passthrough on POST /api/runs/[id]/messages — forward-compatible since 17-01 (silently stripped pre-17-03)
  - phase: 17-02
    provides: artifacts.extracted_text column + agentId='user' rows + the (runId, agentId='user') ownership scope this plan enforces

provides:
  - "POST /api/runs/[id]/messages now accepts optional attachmentIds: z.array(z.string().uuid()).max(4).default([])"
  - "apps/web/lib/attachment-block.ts — pure buildAttachmentBlock(rows) + mimeLabel(mime) helpers used by the messages route"
  - "Strict (runId, agentId='user') ownership check — rows.length !== attachmentIds.length → 404 'attachment not found'"
  - "Client-specified attachment order preserved (Map reordering) so [1], [2], etc. line up with the user's chip-stack selection order"
  - "ZodError → 400 path added to messages route (was previously 500-only)"
  - "Bonus: apps/agent-hub typecheck baseline restored to zero errors (sendToAgent return type widened to include costUsd + model)"

affects: [17-04]

tech-stack:
  added: []
  patterns:
    - "Web-app-side prompt-prepend (V1 simplification per PATTERNS.md): build the attachment block in apps/web, NOT in the hub. RunStartBody / OpenClawOutbound / openclaw-cli-bridge.ts are unchanged — the hub just sees a longer prompt string."
    - "Strict ownership 404 (no silent skip) — every attachmentId must resolve against (runId, agentId='user'). Cross-run reuse, agent-output impersonation, and post-deletion reuse all fail loudly rather than silently dropping the artifact from the prompt (threat register T-17-03-02 / T-17-03-03 / T-17-03-06)."
    - "inArray + Map reordering — drizzle's WHERE inArray(...) returns rows in arbitrary order; rebuild order from the client's attachmentIds array so the prompt block numbering matches the user's selection sequence."
    - "Pure attachment-block helper extracted to lib/ — Next.js 15 route files may only export GET/POST/etc., so the formatting helper had to live in a sibling module to be unit-testable. Same pattern as buildSendMessageBody (Plan 17-01)."

key-files:
  created:
    - apps/web/lib/attachment-block.ts
    - apps/web/lib/attachment-block.test.ts
  modified:
    - apps/web/app/api/runs/[id]/messages/route.ts
    - apps/agent-hub/src/connections/openclaw-cli-bridge.ts

key-decisions:
  - "[Phase 17-03]: Option A (helper-extracted) chosen over Option B (inline). Pulled buildAttachmentBlock + mimeLabel + MIME_LABELS into apps/web/lib/attachment-block.ts so the formatting logic is unit-testable without spinning up the route. Next.js 15 forbids non-GET/POST/etc. exports from route files, which would have made inline coverage impossible."
  - "[Phase 17-03]: Strict 404 ownership path (CONTEXT 'choose the strict path'). Any mismatch between requested attachmentIds and resolved (runId + agentId='user') rows fails the request with `{ error: 'attachment not found' }`. Silent-skip would let a sender bypass cross-run tampering and agent-output-impersonation checks (threat register T-17-03-02 / T-17-03-03)."
  - "[Phase 17-03]: V1 simplification — prepend in the web app, not the hub. Keeps hubClient.startRun signature, RunStartBody Zod schema, OpenClawOutbound, openclaw-cli-bridge.ts, and packages/shared/src/hub-events.ts entirely unchanged. The hub treats the longer prompt as a normal prompt; round-table wrapping in routes.ts:178-187 still works because the [SYSTEM] groupContext sits OUTSIDE the userPrompt parameter."
  - "[Phase 17-03]: Image base64 pass-through is explicitly deferred. Image attachments contribute the textual placeholder `(image — included with this message)` (exact wording from CONTEXT — NOT 'see attached'). Wiring image base64 through the OpenClaw CLI bridge (openclaw-cli-bridge.ts:22-25 currently shells out with --message string-only) is a separate effort that requires either a CLI flag extension or a data-URI-in-prompt convention; CONTEXT.md set a 30-min budget on it and recommends shipping text-only first."
  - "[Phase 17-03]: ZodError now branches to 400 in the catch block (was previously caught only by the 500 fallback). The new attachmentIds field validates as UUIDs with max(4); without the ZodError handler, an invalid UUID would surface as a generic 500 'Internal server error' rather than a usable 400 with the zod error message."
  - "[Phase 17-03]: Client-specified order preserved via Map reordering. drizzle's WHERE inArray(...) returns rows in arbitrary order; we rebuild the prompt block numbering from the client's attachmentIds array so [1] / [2] / [3] match the user's chip-stack selection sequence rather than database row insertion order."
  - "[Phase 17-03]: Bonus fold-in — apps/agent-hub typecheck drift fixed. The deferred-items.md log from 17-01 flagged three TS errors (TS2353 + 2× TS2339) caused by sendToAgent's return type missing costUsd + model. The implementation already returned both fields and the consumer in routes.ts already read them; only the Promise<...> return shape was stale. One-line widening committed as a separate `fix(17-03):` commit so it's auditable."

patterns-established:
  - "Web-app-side prompt-prepend for hub-bound attachments (vs structured-attachments-on-hub-payload). Use this pattern for any 'agent context' that's text-derivable in the web app — keeps the hub schema stable and unblocks the web-app team without coordinating a hub release."
  - "Strict-404 ownership pattern for *-by-id list lookups: when the client passes [id1, id2, ...], match rows.length !== ids.length and reject the whole request rather than silently dropping. Use the row count as a structural integrity check for any cross-tenant/cross-resource scope."
  - "Map(rows.map(r => [r.id, r])) + array.map(id => byId.get(id)) reorder pattern — apply whenever drizzle WHERE inArray(...) drops the client-specified order on the floor."

requirements-completed: [UAT-17-03]

duration: 4min
completed: 2026-04-28
---

# Phase 17 Plan 03: Agent Context Delivery via Prompt-Prepend Summary

**POST /api/runs/[id]/messages now accepts an optional attachmentIds[] body field, looks up artifact rows scoped to (runId, agentId='user') with a strict 404 ownership check, builds a canonical `--- USER ATTACHMENTS ---` block via a new pure helper in apps/web/lib/attachment-block.ts, and prepends it to the user prompt before forwarding to hubClient.startRun — no hub schema change, image base64 pass-through explicitly deferred per V1 simplification.**

## Performance

- **Duration:** ~4 min (commits 09:25 → 09:29 ET, 2026-04-28)
- **Tasks:** 1 (TDD-split into RED + GREEN)
- **Files:** 4 touched (2 new, 2 modified) — attachment-block.ts + test, messages/route.ts, openclaw-cli-bridge.ts (fold-in)
- **Tests:** +14 new vitest cases in 1 new test file; full suite 179 → 193 (all green)
- **Lines:** ~338 lines of source/test added; ~5 lines modified in route.ts; +6 lines in openclaw-cli-bridge.ts return type

## Accomplishments

### Task 1 — `buildAttachmentBlock` helper + messages route extension (commits `2937388` test, `c7dda83` impl)

#### `apps/web/lib/attachment-block.ts` (new — 89 lines)

- **`MIME_LABELS`** record mapping the 7 ALLOWED_MIME types from CONTEXT to short human-readable labels:
  - `application/pdf` → `PDF`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `DOCX`
  - `image/png` → `PNG`, `image/jpeg` → `JPEG`, `image/webp` → `WEBP`
  - `text/plain` → `TXT`, `text/markdown` → `MD`
- **`mimeLabel(mimeType: string): string`** — exported. Falls back to the raw mime type for unknown values so nothing silently disappears from the rendered block.
- **`ArtifactRow`** interface — 4-field shape (`filename`, `mimeType`, `sizeBytes`, `extractedText: string | null`) matching what the messages route SELECTs from `schema.artifacts`.
- **`buildAttachmentBlock(rows: ArtifactRow[]): string`** — exported. Returns `''` for empty input so callers can unconditionally prepend the result. For each row:
  - Header line: `[N] ${filename} (${mimeLabel}, ${formatSize(sizeBytes)})`
  - Body precedence: `extractedText` (raw, no fencing) > `mimeType.startsWith('image/')` → `(image — included with this message)` > `(no extracted text available)`
  - Trailing: closes with `--- END ATTACHMENTS ---` followed by exactly two newlines (`\n\n`) so the user content begins on its own line.

#### `apps/web/lib/attachment-block.test.ts` (new — 112 lines, 14 vitest cases)

- **mimeLabel:** 7 known mime → label mappings via `it.each(...)` plus 1 unknown-fallback case (8 total).
- **buildAttachmentBlock (6 cases):**
  - Empty input → empty string.
  - Canonical block w/ extracted text — verifies the four sentinel substrings + the `(PDF, 138.7 KB)` size formatting + the trailing `\n\n`.
  - Image placeholder — null `extractedText` + `image/png` → contains `(image — included with this message)`.
  - No-text placeholder — null `extractedText` + `application/pdf` → contains `(no extracted text available)`.
  - Numbering + array order — `[1] a.txt` precedes `[2] b.txt` in output.
  - Mixed text + image attachments — both numbered correctly, each gets its appropriate body, ends with sentinel + `\n\n`.

#### `apps/web/app/api/runs/[id]/messages/route.ts` (modified)

- **Imports:** added `inArray, and` from `drizzle-orm` (alongside existing `eq, asc`); added `buildAttachmentBlock` from `@/lib/attachment-block`. Existing `formatSize` import is no longer needed in this file because formatting now happens inside `attachment-block.ts`.
- **Zod schema:** widened `SendMessageBody` to `{ content: z.string().min(1), attachmentIds: z.array(z.string().uuid()).max(4).default([]) }` with an inline comment explaining the backward-compat default.
- **POST handler:**
  - Conditionally executes the artifacts SELECT only when `attachmentIds.length > 0`.
  - WHERE clause: `and(inArray(schema.artifacts.id, attachmentIds), eq(schema.artifacts.runId, runId), eq(schema.artifacts.agentId, 'user'))`.
  - Strict ownership check: `rows.length !== attachmentIds.length` → 404 `{ error: 'attachment not found' }`.
  - Client-order preservation: builds `Map<id, row>` from the SELECT result, then reorders by `attachmentIds.map(id => byId.get(id))` so prompt numbering tracks the user's selection sequence.
  - Forwards `prompt: attachmentBlock + content` to `hubClient.startRun` — single concatenation, hub schema unchanged.
- **Catch block:** added `if (error instanceof z.ZodError) return 400 { error: error.message }` branch above the existing 500 fallback. ZodError previously fell through to 500.
- **GET handler:** unchanged (regression check via `git diff` — same 32 lines as before this plan).

### Bonus fold-in — agent-hub typecheck baseline restored (commit `d94e0b6`)

- **`apps/agent-hub/src/connections/openclaw-cli-bridge.ts`** — widened `sendToAgent` return type from `Promise<{ text; runId; durationMs } | null>` to `Promise<{ text; runId; durationMs; costUsd: number; model: string } | null>`. The implementation at line 73 already returned `{ text, runId, durationMs, costUsd, model }` and the consumer at `routes.ts:201` already read `result.costUsd` and `result.model` when publishing the agent_message metadata — only the Promise<...> shape was stale.
- **Trigger:** `.planning/phases/17-attachments/deferred-items.md` flagged three TS errors (TS2353 on the implementation + 2× TS2339 on the consumers) during 17-01's monorepo-wide typecheck pass. 17-03's PROMPT explicitly requested folding this in if the fix was small (it was: 6 lines on the return type signature, no behavior change).
- **Result:** `corepack pnpm --filter @beagle-console/agent-hub exec tsc --noEmit` exits 0; was failing with 3 errors before this commit.

## Task Commits

| Hash       | Message                                                                |
| ---------- | ---------------------------------------------------------------------- |
| `2937388`  | test(17-03): add failing tests for buildAttachmentBlock helper (RED)   |
| `c7dda83`  | feat(17-03): prepend attachment block to messages route prompt (GREEN) |
| `d94e0b6`  | fix(17-03): widen sendToAgent return type to include costUsd + model   |

## Files Created/Modified

| File                                                                           | Status | Role                                                                                                  |
| ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `apps/web/lib/attachment-block.ts`                                             | NEW    | Pure helpers `buildAttachmentBlock` + `mimeLabel` + `ArtifactRow` interface                           |
| `apps/web/lib/attachment-block.test.ts`                                        | NEW    | 14 vitest cases covering mimeLabel + buildAttachmentBlock branches                                    |
| `apps/web/app/api/runs/[id]/messages/route.ts`                                 | MODIFY | POST now accepts `attachmentIds`, builds + prepends block, strict 404 ownership check, ZodError → 400 |
| `apps/agent-hub/src/connections/openclaw-cli-bridge.ts`                        | MODIFY | (Bonus fold-in) widen `sendToAgent` return type — closes pre-existing typecheck drift                 |

## Endpoint Contract

**Request:**
- `POST /api/runs/[id]/messages`
- Auth: session cookie via `requireTenantContext()`
- Content-Type: `application/json`
- Body:
  ```json
  {
    "content": "string (>=1 char)",
    "attachmentIds": ["uuid", "uuid"]
  }
  ```
  - `content` is required.
  - `attachmentIds` is optional. If absent or `[]`, the route preserves pre-17-03 behavior (only `content` flows to the hub). Maximum 4 UUIDs; each must be a valid UUID string.

**Response 200:** `{ "ok": true }`

**Error responses (all `{ error: string }`):**

| Status | Trigger                                                                             |
| ------ | ----------------------------------------------------------------------------------- |
| 400    | ZodError — non-UUID in attachmentIds, > 4 attachmentIds, missing content, etc.      |
| 404    | One or more attachmentIds did not resolve to (this runId, agentId='user') artifacts |
| 500    | Generic — DB failure, hub failure, etc.                                             |

**Prompt construction sent to hub:**
```
--- USER ATTACHMENTS ---
[1] filename1.pdf (PDF, 138.7 KB)
<extracted text contents...>
[2] screenshot.png (PNG, 37.1 KB)
(image — included with this message)
--- END ATTACHMENTS ---

<user's content>
```

When `attachmentIds` is empty/absent, the prompt is simply `<user's content>` (zero-length prefix).

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Web-app-side prompt-prepend (Option A in PATTERNS.md).** The simpler V1 path keeps the hub schema, OpenClaw CLI bridge, and shared event types untouched. The hub treats the longer prompt as a normal prompt; the round-table wrapping in `routes.ts:178-187` still works because the `[SYSTEM] groupContext` sits OUTSIDE the `userPrompt` parameter.
- **Strict 404 ownership path.** CONTEXT explicitly recommends "choose the strict path (404)" and the threat register marks T-17-03-02 (cross-run tampering) and T-17-03-03 (agent-output impersonation) as `mitigate` dispositions. Silent-skip would let a sender pass `attachmentIds: ['<another-run-uuid>']` and have the route silently drop them from the prompt — failing loudly is the structural-integrity check.
- **Helper module over inline.** Next.js 15 routes may only export GET/POST/etc. — exporting `buildAttachmentBlock` from `route.ts` would break the production typecheck. Pulling the helper into `apps/web/lib/attachment-block.ts` is the same pattern Plan 17-01 used for `buildSendMessageBody` (extracted from `useSendMessage` for the same reason).
- **Image base64 pass-through deferred.** Image attachments contribute the textual placeholder `(image — included with this message)` for V1. Wiring base64 through the OpenClaw CLI bridge requires either a CLI flag extension or a data-URI-in-prompt convention; CONTEXT.md set a 30-min budget on it and recommends shipping text-only first. Tracked in the `## Deferred` section of CONTEXT.
- **ZodError → 400 added to catch block.** Pre-17-03 the route caught only generic errors and returned 500. With the new `attachmentIds` validation, an invalid UUID would otherwise surface as a misleading "Internal server error" — adding the explicit branch makes the error message usable.
- **Map reordering for client-specified order.** `inArray(...)` returns rows in arbitrary order; the prompt block numbers `[1]`, `[2]`, `[3]` need to match the user's chip-stack selection sequence. `Map(rows.map(r => [r.id, r])) + ids.map(id => byId.get(id))` is the cheapest reorder.

## Deviations from Plan

None for the core 17-03 work — Task 1 executed exactly as the `<action>` block specified, all 13 acceptance criteria pass on a literal grep:

- `attachmentIds: z.array(z.string().uuid()).max(4).default([])` — present (8 occurrences of `attachmentIds` in route.ts).
- `inArray, and` imported from `drizzle-orm` — present.
- Conditional `if (attachmentIds.length > 0)` SELECT branch — present.
- `eq(schema.artifacts.runId, runId)` and `eq(schema.artifacts.agentId, 'user')` — both present (1 match each).
- `{ error: 'attachment not found' }` with status 404 — present.
- `prompt: attachmentBlock + content` — present (1 match).
- `instanceof z.ZodError` → 400 — present.
- `--- USER ATTACHMENTS ---`, `--- END ATTACHMENTS ---`, `(image — included with this message)` — all present in `apps/web/lib/attachment-block.ts`.
- `apps/web/lib/attachment-block.ts` and `apps/web/lib/attachment-block.test.ts` both exist.
- `pnpm exec vitest run lib/attachment-block.test.ts` exits 0 (14/14 passing).
- `pnpm exec tsc --noEmit` exits 0 in `apps/web`.
- GET handler unchanged.

### Bonus fold-in (Rule 3 — blocking-issue auto-fix per executor scope policy)

**1. [Rule 3 - Blocking] apps/agent-hub typecheck baseline drift**

- **Found during:** Pre-flight monorepo typecheck — confirmed the deferred-items.md log from 17-01.
- **Issue:** `sendToAgent`'s declared return type was `Promise<{ text; runId; durationMs } | null>` but the implementation returned `{ text, runId, durationMs, costUsd, model }`, and `routes.ts:201` read `.costUsd` and `.model` when publishing agent_message metadata. Three TS errors (TS2353 on the impl literal + 2× TS2339 on the consumer reads) blocked `apps/agent-hub` typecheck.
- **Fix:** Widened the Promise return type to include `costUsd: number` and `model: string`. Six lines added to the function signature; no behavior change.
- **Files modified:** `apps/agent-hub/src/connections/openclaw-cli-bridge.ts`
- **Commit:** `d94e0b6`
- **Scope justification:** The PROMPT explicitly authorized this fold-in: *"if it's a quick fix (likely a missing field on a type, or stale type definition) and address it as an additional commit at the end of this plan."* It was — 6 lines, one file, mechanical.

## Auth gates

None. The endpoint defers auth to `requireTenantContext()` which is unchanged from pre-17-03. The new `(runId, agentId='user')` ownership scope is enforced at the SELECT WHERE clause, not at the auth layer.

## Issues Encountered

- **`pnpm` not on Windows PATH.** Same gap documented across every prior plan on this machine. Worked around by routing every `pnpm` invocation through `corepack pnpm …`. Both `tsc --noEmit` and `vitest run` exit 0 across `apps/web`, `apps/agent-hub`, and `packages/db`.
- **CRLF warnings on every commit.** Standard Windows git behavior; no action needed. All three Task commits ran `git commit` without `--no-verify` so any pre-commit hooks fired (none currently configured for this repo).

## Threat Model Status

| Threat ID    | Status     | Notes                                                                                                                                                                                                                              |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-17-03-01   | Mitigated  | `getTenantDb(tenantId)` selects from the caller's tenant schema. Cross-tenant artifact IDs would not even resolve to a row in the tenant_<id>.artifacts table.                                                                     |
| T-17-03-02   | Mitigated  | The SELECT has `eq(schema.artifacts.runId, runId)` ensuring the artifact was uploaded to this exact run. Cross-run reuse triggers the strict 404 path.                                                                             |
| T-17-03-03   | Mitigated  | The SELECT has `eq(schema.artifacts.agentId, 'user')` — only user-uploaded files can be referenced. Agent-produced artifacts (e.g. Mo's outputs) would not match and trigger 404.                                                  |
| T-17-03-04   | Accepted   | LLM prompt injection via extracted text — same trust level as the user's prompt itself. The `--- USER ATTACHMENTS ---` block makes the boundary explicit to the agent (prompt engineering); we do NOT escape the body.             |
| T-17-03-05   | Accepted   | DoS via 4× 50K-char attachments = 200K chars per message. Well within Anthropic Opus / OpenClaw's context window. Existing user-message rate limits cover the per-second case.                                                     |
| T-17-03-06   | Mitigated  | Information disclosure from deleted/revoked artifacts — the SELECT count mismatch triggers 404 with the generic `'attachment not found'` error. No info leaks.                                                                     |

## User Setup Required

None for Plan 17-03 itself — code-only plan, the path is live the moment Plan 17-04 ships the migration + container rebuild. The contract aligns with what 17-01's composer and 17-02's endpoint already produce:

1. User attaches a PDF + an image via the composer paperclip (17-01).
2. Composer POSTs each to `/api/runs/[id]/attachments` (17-02), receives `artifactId`s, flips chips to ready.
3. User clicks Send. Composer POSTs `{ content, attachmentIds: ['<pdf-id>', '<png-id>'] }` to `/api/runs/[id]/messages` (THIS plan).
4. Route SELECTs both artifact rows scoped to (runId, agentId='user'), builds the canonical block, prepends to the user prompt, forwards combined string to `hubClient.startRun`.
5. Hub treats the longer prompt as a normal prompt, runs the round-table; Mo, Jarvis, and Herman all see the `--- USER ATTACHMENTS ---` block before the user's question.

## Known Stubs

None. All three commits ship working code paths — no hardcoded empty arrays flowing to UI, no placeholder strings, no TODO/FIXME markers. The only "deferred" surface is the image base64 pass-through, which is a documented future-track decision (see "Decisions Made") and is gracefully degraded to the `(image — included with this message)` textual placeholder.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what's covered by the existing threat register. `apps/agent-hub/src/connections/openclaw-cli-bridge.ts` was modified, but the change is a return-type signature widening with zero runtime behavior change.

## Next Phase Readiness

- **Plan 17-04 (deploy + UAT)** can now exercise the full path:
  1. Run `migrate-17.ts` against staging (idempotent — adds `extracted_text` column).
  2. Rebuild + push the `apps/web` container with the new endpoint signatures.
  3. Smoke test:
     - Paperclip a PDF + a PNG onto a fresh run → both upload via `/api/runs/[id]/attachments` → chips flip to ready.
     - Click Send → `/api/runs/[id]/messages` POST with `{ content, attachmentIds: [...] }`.
     - Confirm in agent-hub logs that the prompt sent to Mo / Jarvis / Herman includes the `--- USER ATTACHMENTS ---` block, the PDF's extracted text, and the `(image — included with this message)` placeholder.
     - Confirm at least one agent's reply references the attached content (PDF text quote or "I see the image you attached").
- **No structured-attachment-payload coordination required** — the hub is unchanged, so 17-04's deploy is a single-app rebuild (apps/web) plus the migration, exactly like Plan 17-02 prepared for.

## Self-Check: PASSED

- `apps/web/lib/attachment-block.ts` — FOUND (89 lines)
- `apps/web/lib/attachment-block.test.ts` — FOUND (112 lines, 14 cases)
- `apps/web/app/api/runs/[id]/messages/route.ts` — FOUND (137 lines, modified)
- `apps/agent-hub/src/connections/openclaw-cli-bridge.ts` — FOUND (modified, return type widened)
- Commit `2937388` (Task 1 RED) — FOUND
- Commit `c7dda83` (Task 1 GREEN) — FOUND
- Commit `d94e0b6` (agent-hub fold-in) — FOUND
- `corepack pnpm -F web exec tsc --noEmit` → exit 0
- `corepack pnpm --filter @beagle-console/agent-hub exec tsc --noEmit` → exit 0 (was failing with 3 errors before fold-in)
- `corepack pnpm --filter @beagle-console/db exec tsc --noEmit` → exit 0
- `corepack pnpm -F web exec vitest run` → 193/193 passing (was 179 before plan)
- `corepack pnpm -F web exec vitest run lib/attachment-block.test.ts` → 14/14 passing
- Acceptance grep: `attachmentIds` (8x in route.ts), `--- USER ATTACHMENTS ---` (3x in attachment-block.ts), `image — included with this message` (4x), `attachmentBlock + content` (1x), `instanceof z.ZodError` (1x), `eq(schema.artifacts.agentId, 'user')` (1x) — all required matches present.

## TDD Gate Compliance

The plan declared `tdd="true"` on Task 1. Both gates fired correctly:

- **RED gate:** test commit `2937388` — `Cannot find module './attachment-block'` from `attachment-block.test.ts:2`. Suite failed with 0 tests run. Confirmed RED before proceeding to GREEN.
- **GREEN gate:** impl commit `c7dda83` — 14 tests passing in 290ms, full apps/web suite 193 green, `tsc --noEmit` clean.

No REFACTOR commit — the implementation was minimal-to-pass on the first GREEN pass and required no cleanup.

The bonus fold-in commit (`d94e0b6`) is a non-TDD `fix(...)` commit per the deferred-items workflow: a one-line type fix with zero behavior change is verified by `tsc --noEmit` (which exits 0 on agent-hub for the first time post-Phase-12) rather than a new test.

---
*Phase: 17-attachments*
*Completed: 2026-04-28*
