---
phase: 17-attachments
plan: 02
subsystem: api
tags: [attachments, multipart, minio, pdf-parse, mammoth, drizzle, migration, rate-limit, vitest, tdd]

requires:
  - phase: 07
    provides: getMinioClient (re-exported from @beagle-console/db) + tenant-${tenantId} bucket convention + GetObjectCommand pattern in artifacts/[id]/preview
  - phase: 13
    provides: Improve-prompt rate limiter pattern (in-memory Map<userId, timestamps[]>) — copied verbatim with 30→10 cap swap
  - phase: 14
    provides: shared.organizations as the canonical tenant source (NOT shared.tenants — Phase 14 fix carried into migrate-17.ts)
  - phase: 17-01
    provides: uploadAttachment client + AttachmentUploadError + UploadResponse contract — endpoint matches exactly

provides:
  - "POST /api/runs/[id]/attachments — multipart upload + MinIO + extraction + artifacts insert"
  - "apps/web/lib/extract-attachment.ts — server-only extractAttachment(buffer, mimeType) with EXTRACT_CAP=50000"
  - "apps/web/lib/attachment-upload-rate-limit.ts — 10 req/min/user limiter sibling to improve-prompt-rate-limit.ts"
  - "packages/db/src/scripts/migrate-17.ts — idempotent ALTER TABLE artifacts ADD COLUMN extracted_text TEXT per tenant"
  - "Drizzle artifacts table extractedText: text('extracted_text') (nullable)"
  - "apps/web/types/pdf-parse.d.ts — ambient module decl for the lib subpath import"

affects: [17-03, 17-04]

tech-stack:
  added:
    - "pdf-parse@1.1.1 (apps/web dependency — CONTEXT.md was wrong about it being preinstalled)"
  patterns:
    - "Dynamic-import pdf-parse via 'pdf-parse/lib/pdf-parse.js' subpath to skip the package's debug auto-load that crashes outside its own directory"
    - "Pass new Uint8Array(buffer) to pdf-parse instead of raw Node Buffer — pdfjs v1.10.100 (bundled by pdf-parse) misreads Node 20+ Buffers as 'bad XRef entry'"
    - "Multipart upload via Next 15 await request.formData() + file instanceof File typeguard"
    - "MinIO PutObjectCommand from @aws-sdk/client-s3 — net-new in this repo (existing routes only Get/presign)"
    - "Idempotent ALTER TABLE ADD COLUMN IF NOT EXISTS per-tenant try/catch (modeled on migrate-13.ts)"
    - "Ambient module decl in apps/web/types/ for libraries that ship CommonJS without first-class @types"

key-files:
  created:
    - apps/web/lib/extract-attachment.ts
    - apps/web/lib/extract-attachment.test.ts
    - apps/web/lib/attachment-upload-rate-limit.ts
    - apps/web/lib/attachment-upload-rate-limit.test.ts
    - apps/web/lib/__fixtures__/tiny.pdf
    - apps/web/lib/__fixtures__/tiny.png
    - apps/web/lib/__fixtures__/tiny.txt
    - apps/web/lib/__fixtures__/tiny.md
    - apps/web/app/api/runs/[id]/attachments/route.ts
    - apps/web/types/pdf-parse.d.ts
    - packages/db/src/scripts/migrate-17.ts
  modified:
    - apps/web/package.json
    - packages/db/src/schema/tenant.ts
    - pnpm-lock.yaml

key-decisions:
  - "[Phase 17-02]: pdf-parse was NOT preinstalled (CONTEXT.md error caught by PATTERNS.md). Added pdf-parse@1.1.1 as a runtime dep of apps/web. No @types/pdf-parse — ships none in 1.1.1 and adding the @types package triggers a 'Cannot find module' resolution conflict per the plan's note. Chose the ambient-module-declaration path (apps/web/types/pdf-parse.d.ts) for the subpath we actually use."
  - "[Phase 17-02]: Imported pdf-parse via the lib subpath 'pdf-parse/lib/pdf-parse.js' rather than the package root. Root entry ('pdf-parse') has a debug-mode auto-load that tries to read ./test/data/05-versions-space.pdf at require-time, crashing with ENOENT outside the package's own working dir. The subpath skips that auto-load. Documented inline."
  - "[Phase 17-02]: Pass new Uint8Array(buffer) to pdf-parse instead of the raw Node Buffer. pdf-parse 1.1.1 bundles pdfjs v1.10.100, whose XRef parser misreads Node 20+ Buffers and throws 'bad XRef entry' on every PDF (verified locally on Node 24). Uint8Array conversion is a 1-line fix and works across Node versions. Documented inline so future maintainers don't revert it."
  - "[Phase 17-02]: DOCX positive test mocks mammoth at the module boundary via vi.mock instead of committing a real .docx fixture. The DOCX dispatch branch is structurally identical to TXT/MD (call → assign → cap), and the PDF positive path already covers the dynamic-import + try/catch behaviour end-to-end with a real fixture. The mock asserts 'we call extractRawText and pass through .value', which is the only thing the surface-under-test owns."
  - "[Phase 17-02]: Rate limiter forked into its own module (attachment-upload-rate-limit.ts) rather than parameterizing improve-prompt-rate-limit. Next.js 15 routes can only export GET/POST/etc — sharing a module would force the limiter into a route file or conflate two unrelated caps. Sibling modules with hand-tuned constants stays cleanest."
  - "[Phase 17-02]: tiny.pdf fixture generated via pdfkit (installed transiently, removed before commit). Hand-rolling a valid PDF with correct xref byte offsets failed three times — pdfkit's emit is the cheapest reproducible path. The generated file is 1274 bytes and parses cleanly via pdf-parse + Uint8Array."
  - "[Phase 17-02]: Migration script reads from shared.organizations (not shared.tenants) per the Phase 14 fix carried in migrate-13.ts. shared.tenants is empty by convention; provision-tenant inserts the org id which becomes the tenant_<id> schema name. Per-tenant try/catch so one bad tenant doesn't block the rest."
  - "[Phase 17-02]: MinIO upload happens BEFORE the artifacts row insert. If the upload fails, no orphan row in the DB — caller sees 500 and retries. If extraction fails after upload (extractAttachment returns null), the row still inserts with extracted_text=NULL and 200 returns; the user can still download the file, the agent just won't see text. This matches CONTEXT's failure-mode spec."
  - "[Phase 17-02]: NEXT_REDIRECT propagation in the catch block — requireTenantContext throws NEXT_REDIRECT for unauthed callers, and we must NOT swallow that as a 500 (Next.js needs to actually do the redirect). Same pattern as improve-prompt/route.ts."

patterns-established:
  - "Ambient module decl per consumed-subpath pattern: apps/web/types/<lib>.d.ts when @types is broken or absent"
  - "pdf-parse usage: import from 'pdf-parse/lib/pdf-parse.js' + pass new Uint8Array(buf), document both with inline comments"
  - "Migration script template (post-Phase-14): reads shared.organizations, sanitizes id with replace(/-/g, '_'), wraps each tenant in try/catch, idempotent ALTER ... IF NOT EXISTS"

requirements-completed: [UAT-17-02]

duration: 9min
completed: 2026-04-28
---

# Phase 17 Plan 02: Storage + Text-Extraction Backend Summary

**MinIO-backed POST /api/runs/[id]/attachments with synchronous PDF/DOCX/TXT/MD extraction, 10-req/min rate limiter, Drizzle schema column, and idempotent migration script — completes UAT-17-02 and unblocks Plan 17-03's round-table delivery.**

## Performance

- **Duration:** ~9 min (commits 09:13 → 09:18 ET, 2026-04-28)
- **Tasks:** 2 (each split RED → GREEN per TDD plan)
- **Files:** 14 touched (11 new, 3 modified)
- **Tests:** +14 new vitest cases across 2 new test files; full suite 165 → 179 (all green)

## Accomplishments

### Task 1 — pdf-parse install + extract-attachment + Drizzle column + migrate-17 (commits `f36a968` test, `18cadb3` impl)

- **`apps/web/package.json`** — added `"pdf-parse": "1.1.1"`. CONTEXT.md was wrong; PATTERNS.md correction confirmed. `pnpm install` updated `pnpm-lock.yaml` (committed).
- **`apps/web/types/pdf-parse.d.ts`** (new) — ambient module decl for `'pdf-parse/lib/pdf-parse.js'` typing `pdfParse(data: Buffer | Uint8Array): Promise<{ text: string; numpages?, info? }>` — enough to satisfy strict tsc without pulling `@types/pdf-parse` (which conflicts).
- **`apps/web/lib/extract-attachment.ts`** (new):
  - `EXTRACT_CAP = 50_000` exported.
  - `extractAttachment(buffer: Buffer, mimeType: string): Promise<string | null>` dispatches:
    - PDF → dynamic import `pdf-parse/lib/pdf-parse.js`, parse `new Uint8Array(buffer)` (pdfjs v1.10.100 quirk, see decisions).
    - DOCX → `mammoth.extractRawText({ buffer })`.
    - TXT/MD → `buffer.toString('utf-8')`.
    - PNG/JPG/WEBP → return `null` (vision models read the bytes directly).
    - Anything else → return `null` (defensive default).
  - Truncates outputs > `EXTRACT_CAP` to exactly `EXTRACT_CAP` chars + `\n\n[... truncated, original ${buffer.length} bytes ...]`.
  - Wraps the whole body in try/catch; on failure logs `console.warn('extractAttachment failed:', err)` and returns `null` so the route handler still uploads + inserts.
- **`apps/web/lib/extract-attachment.test.ts`** (new, 10 cases):
  - PDF positive (`/Hello/i` from the pdfkit-generated fixture)
  - TXT positive (`hello phase 17 attachments`)
  - MD positive (`# Phase 17`)
  - PNG/JPEG/WEBP → all null
  - Unknown mime → null
  - Oversize TXT → first `EXTRACT_CAP` chars are `'x'`, then truncation marker matched via regex
  - Malformed PDF → null + warn logged + warn restored
  - DOCX positive via top-of-file `vi.mock('mammoth', ...)` returning `{ value: 'hello docx' }`
- **`apps/web/lib/__fixtures__/`** (4 binaries committed):
  - `tiny.pdf` (1274 B, generated transiently with pdfkit then committed)
  - `tiny.png` (70 B, 1×1 transparent PNG from a known base64)
  - `tiny.txt` (utf-8 line)
  - `tiny.md` (markdown header + body)
- **`packages/db/src/schema/tenant.ts`** (modified) — single-line addition: `extractedText: text('extracted_text'),` (nullable, no `.notNull()`).
- **`packages/db/src/scripts/migrate-17.ts`** (new) — modeled on `migrate-13.ts`:
  - Reads `SELECT id FROM shared.organizations` (Phase 14 fix carried).
  - Per-tenant `try/catch` around `ALTER TABLE ${schemaName}.artifacts ADD COLUMN IF NOT EXISTS extracted_text text`.
  - Logs successes + failures; finishes with the tenant count.
  - Direct invocation guard at the bottom: `if (import.meta.url.endsWith(process.argv[1] ?? ''))`.
  - Run via `pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-17.ts` (executed in Plan 17-04 deploy).

### Task 2 — Rate limiter + POST /api/runs/[id]/attachments (commits `08cca66` test, `0c65640` impl)

- **`apps/web/lib/attachment-upload-rate-limit.ts`** (new):
  - `RATE_LIMIT_MAX = 10`, `RATE_LIMIT_WINDOW_MS = 60_000`.
  - `userTimestamps: Map<string, number[]>` — same shape as improve-prompt-rate-limit.ts.
  - `rateLimitOk(userId)` filters timestamps to the last 60s, returns `false` if ≥10 already, else pushes `now` and returns `true`. Persists trimmed list to bound memory.
  - `resetRateLimiterForTest()` clears the map.
- **`apps/web/lib/attachment-upload-rate-limit.test.ts`** (new, 4 cases): allow-first-10, reject-11th, per-user isolation, reset-clears.
- **`apps/web/app/api/runs/[id]/attachments/route.ts`** (new):
  - `export const runtime = 'nodejs';`
  - Auth: `const { session, tenantId } = await requireTenantContext()` then `getTenantDb(tenantId)`.
  - Param validation: `RunIdParam = z.object({ id: z.string().uuid() })` from `'zod/v4'`.
  - Rate limit gate → 429 `{ error: 'rate limit exceeded' }`.
  - Multipart parse: `await request.formData()` → `formData.get('file')` → `instanceof File` typeguard → 400 `{ error: 'file field required' }`.
  - Mime validation against `ALLOWED_MIME` (the 7-element set from CONTEXT) → 400 `{ error: 'unsupported type' }`.
  - Size validation against `MAX_SIZE_BYTES = 20 * 1024 * 1024` → 400 `{ error: 'file too large' }`.
  - Bytes via `Buffer.from(await file.arrayBuffer())`.
  - Filename → ext: `dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin'`.
  - MinIO key: `runs/${runId}/uploads/${randomUUID()}.${ext}`.
  - Bucket: `tenant-${tenantId}`.
  - `await getMinioClient().send(new PutObjectCommand({ Bucket, Key, Body, ContentType }))` — fail-here = no DB row, caller sees 500.
  - `extractedText = await extractAttachment(buffer, file.type)` (null is OK).
  - `tdb.insert(schema.artifacts).values({ runId, filename, mimeType, sizeBytes, minioKey, agentId: 'user', extractedText }).returning()` → defensive `rows[0]` narrow → respond `{ artifactId, filename, mimeType, sizeBytes }`.
  - Catch block: `ZodError → 400`, `NEXT_REDIRECT → re-throw`, else `console.error + 500 'Internal server error'`.

## Task Commits

Each task split into RED + GREEN per TDD discipline:

1. **Task 1 RED — failing tests for extract-attachment** — `f36a968` (test)
2. **Task 1 GREEN — pdf-parse install + extract helper + schema + migrate-17** — `18cadb3` (feat)
3. **Task 2 RED — failing tests for attachment-upload rate limiter** — `08cca66` (test)
4. **Task 2 GREEN — rate limiter + POST endpoint** — `0c65640` (feat)

## Files Created/Modified

| File | Status | Role |
|------|--------|------|
| `apps/web/package.json` | MODIFY | +pdf-parse@1.1.1 dependency |
| `pnpm-lock.yaml` | MODIFY | Lockfile reflects pdf-parse + transitive deps |
| `apps/web/types/pdf-parse.d.ts` | NEW | Ambient module decl for the lib subpath |
| `apps/web/lib/extract-attachment.ts` | NEW | Server-only extractor (PDF/DOCX/TXT/MD/null) |
| `apps/web/lib/extract-attachment.test.ts` | NEW | 10 vitest cases incl. mocked mammoth DOCX path |
| `apps/web/lib/__fixtures__/tiny.pdf` | NEW | 1274-byte pdfkit-generated "Hello World" PDF |
| `apps/web/lib/__fixtures__/tiny.png` | NEW | 70-byte 1×1 transparent PNG |
| `apps/web/lib/__fixtures__/tiny.txt` | NEW | utf-8 text fixture |
| `apps/web/lib/__fixtures__/tiny.md` | NEW | markdown fixture |
| `apps/web/lib/attachment-upload-rate-limit.ts` | NEW | 10/min in-memory limiter sibling |
| `apps/web/lib/attachment-upload-rate-limit.test.ts` | NEW | 4 vitest cases |
| `apps/web/app/api/runs/[id]/attachments/route.ts` | NEW | POST multipart + MinIO + extraction + insert |
| `packages/db/src/schema/tenant.ts` | MODIFY | +extractedText: text('extracted_text') on artifacts |
| `packages/db/src/scripts/migrate-17.ts` | NEW | Idempotent ALTER TABLE per tenant |

## Migration Execution

`migrate-17.ts` is **NOT executed in this plan** — execution is reserved for Plan 17-04 deploy, where it runs FIRST (before container rebuild) per CONTEXT.md "Migration ordering: schema migration runs FIRST in the deploy plan, before container rebuild."

To execute (Plan 17-04):
```bash
pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-17.ts
```
Idempotent — safe to re-run; `ADD COLUMN IF NOT EXISTS` is a no-op on the second invocation.

## Endpoint Contract

**Request:**
- `POST /api/runs/[id]/attachments`
- Auth: session cookie (validated via `requireTenantContext()`)
- Content-Type: `multipart/form-data` with browser-set boundary
- Body: single field `file` (instance of File)
- Path param: `id` = run UUID (Zod-validated)

**Response 200:**
```json
{
  "artifactId": "uuid",
  "filename": "string",
  "mimeType": "string",
  "sizeBytes": 12345
}
```

**Error responses (all `{ error: string }`):**
| Status | Trigger |
|--------|---------|
| 400 | Missing `file` field, mime not in ALLOWED_MIME, size > 20 MB, invalid runId UUID |
| 429 | Caller exceeded 10 uploads/min |
| 500 | MinIO upload failure, DB insert failure, generic |
| (redirect) | No session — `requireTenantContext` redirects to `/login` |

**Allowed mime types (7):**
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `image/png`, `image/jpeg`, `image/webp`
- `text/plain`, `text/markdown`

**MinIO storage:**
- Bucket: `tenant-${tenantId}`
- Key: `runs/${runId}/uploads/${uuid}.${ext}` (ext lowercased from filename, fallback `bin`)
- ContentType: matches `file.type` from the multipart upload

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **pdf-parse import path quirk.** The package root has a debug-mode auto-load that crashes when the working directory is anywhere other than the pdf-parse source dir. We import from `'pdf-parse/lib/pdf-parse.js'` to skip the loader, and we pass `new Uint8Array(buffer)` (not Buffer) because pdfjs v1.10.100 misreads modern Node Buffers and throws `bad XRef entry`. Both are documented inline so a future maintainer doesn't revert them.
- **DOCX positive test mocks mammoth.** Committing a real .docx (a zipped XML bundle) is more cost than the surface-under-test deserves. The DOCX branch is `mammoth.extractRawText({ buffer }) → assign → cap` — same shape as the TXT branch; the PDF positive path already covers the dynamic-import + try/catch behaviour end-to-end with a real fixture.
- **Rate limiter forked, not parameterized.** Next.js 15 routes can only export GET/POST/etc — sharing a module would either force the limiter into a route file or conflate two unrelated caps. Sibling modules (`improve-prompt-rate-limit.ts` at 30/min, `attachment-upload-rate-limit.ts` at 10/min) stays cleanest.
- **MinIO upload before DB insert.** If upload fails, no orphan artifacts row exists. If extraction fails after a successful upload, we still insert the row with `extracted_text=NULL` and return 200; the user can still download the file, the agent just won't see text. This matches CONTEXT's stated failure-mode spec.
- **NEXT_REDIRECT propagation.** `requireTenantContext` throws a NEXT_REDIRECT exception for unauthed callers; the catch block re-throws it so Next.js can actually perform the redirect. Same pattern as `improve-prompt/route.ts`.
- **Migration reads shared.organizations.** Phase 14 fix carried — `shared.tenants` is empty by convention; the canonical iteration target is `shared.organizations`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] pdf-parse 1.1.1 root entry breaks at require-time**

- **Found during:** Task 1 GREEN — verifying the test fixture parses
- **Issue:** `await import('pdf-parse')` triggered a debug-mode auto-load that tries to read `./test/data/05-versions-space.pdf` from the package's own working dir, throwing ENOENT in our project root.
- **Fix:** Import via the lib subpath: `await import('pdf-parse/lib/pdf-parse.js')`. Documented inline in extract-attachment.ts and in the ambient module decl.
- **Files modified:** `apps/web/lib/extract-attachment.ts`, `apps/web/types/pdf-parse.d.ts`
- **Commit:** `18cadb3`

**2. [Rule 1 - Bug] pdfjs v1.10.100 misreads Node 20+ Buffers**

- **Found during:** Task 1 GREEN — running pdf-parse against tiny.pdf with a Buffer input
- **Issue:** Every PDF input threw `bad XRef entry` regardless of whether the PDF was hand-rolled or pdfkit-generated. Root cause: pdfjs v1.10.100 (bundled by pdf-parse 1.1.1) has a Buffer-vs-Uint8Array issue under Node 20+.
- **Fix:** Pass `new Uint8Array(buffer)` to pdf-parse. Verified parsing works on a 1274-byte pdfkit-generated PDF.
- **Files modified:** `apps/web/lib/extract-attachment.ts`
- **Commit:** `18cadb3`

**3. [Rule 2 - Critical] Defensive narrow on `rows[0]` for strict TS**

- **Found during:** Task 2 GREEN — `pnpm exec tsc --noEmit`
- **Issue:** `tdb.insert(...).returning()` types `rows[0]` as possibly undefined; TS18048 errors on `row.id`, `row.filename`, `row.mimeType`, `row.sizeBytes`.
- **Fix:** Narrow with `const row = rows[0]; if (!row) throw new Error('insert returned no row');` — drizzle's `.returning()` always yields the inserted row at runtime, but the type system needs the explicit narrow.
- **Files modified:** `apps/web/app/api/runs/[id]/attachments/route.ts`
- **Commit:** `0c65640`

**4. [Process - fixture generation] pdfkit installed transiently**

- **Found during:** Task 1 GREEN — hand-rolled PDFs with correct xref offsets still failed pdf-parse (independently of the Buffer/Uint8Array fix above; the hand-rolled offsets were technically valid but pdfjs's parser was ungenerous).
- **Action:** `pnpm add -F web -D pdfkit @types/pdfkit` → generate `tiny.pdf` via pdfkit → `pnpm remove -F web pdfkit @types/pdfkit`. Net effect on `package.json` and `pnpm-lock.yaml`: only `pdf-parse@1.1.1` added; pdfkit is gone.
- **Result:** `tiny.pdf` is a committed, valid 1274-byte "Hello World" PDF that parses cleanly via the Uint8Array workaround.

## Auth gates

None. The endpoint defers auth to `requireTenantContext()` which is exercised by every existing tenant-scoped route — no new auth surface.

## Issues Encountered

- **`pnpm` not on Windows PATH.** Same gap documented across prior plans on this machine. Worked around by routing every `pnpm` invocation through `corepack pnpm …` via `powershell.exe -Command`. Both `tsc --noEmit` and `vitest run` exit 0.
- **CRLF warnings on every commit.** Standard Windows behavior; no action needed.

## Threat Model Status

| Threat ID | Status |
|-----------|--------|
| T-17-02-01 (Spoofing — write to another tenant's bucket) | **Mitigated.** `tenantId` comes from `requireTenantContext().tenantId` (session-derived); `runId` is only used for key construction, never bucket lookup. |
| T-17-02-02 (Tampering — disallowed mime via spoofed Content-Type) | **Mitigated.** Server enforces `ALLOWED_MIME` against `file.type`. Spoofed mime only feeds the extractor unexpected bytes, which `extractAttachment` swallows via try/catch. |
| T-17-02-03 (Repudiation — no audit log for uploads) | **Accepted.** The artifacts row IS the audit trail (`createdAt`, `agentId='user'`, `minioKey`). |
| T-17-02-04 (Information disclosure — extracted text leaks PII to other tenants) | **Accepted.** Column is in the per-tenant schema (`tenant_<id>.artifacts`); cross-tenant query is impossible without operator break-glass (Phase 9). |
| T-17-02-05 (DoS — large file or rapid uploads exhaust memory or storage) | **Mitigated.** 20 MB hard cap per file + 10 req/min/user limit. extractAttachment runs in-memory; bounded. Streaming/async-extraction is Phase 18 if measured demand justifies it. |
| T-17-02-06 (EoP — pdf-parse / mammoth RCE on crafted file) | **Mitigated.** Both are pure-JS parsers (no shell-out, no eval). Output is plain text. try/catch contains panics. Upstream CVEs tracked via Renovate. |

## User Setup Required

None for Plan 17-02 itself — code-only plan. The endpoint is live the moment Plan 17-04 ships the migration + container rebuild.

## Next Phase Readiness

- **Plan 17-03 (round-table delivery)** is unblocked — it owns `apps/web/app/api/runs/[id]/messages/route.ts` (widen Zod to accept `attachmentIds`, prepend an attachments block to the prompt) and the agent-hub side. The schema column it'll read (`extracted_text`) is in place; the migration ships in 17-04.
- **Plan 17-04 (deploy + UAT)** can now exercise the full path:
  1. Run `migrate-17.ts` against staging (idempotent — re-runnable).
  2. Rebuild + push the apps/web container with the new endpoint.
  3. Smoke test: paperclip a PDF onto a fresh run → chip flips to ready (200 with `{ artifactId, ... }`) → MinIO has the object at `runs/${runId}/uploads/${uuid}.pdf` → `tenant_<id>.artifacts` has a row with non-NULL `extracted_text`.
  4. UAT-17-02 sign-off: paperclip a 5-page PDF + a screenshot → both upload → confirm extracted text is queryable in DB and image is downloadable from MinIO.

## Self-Check: PASSED

- `apps/web/lib/extract-attachment.ts` — FOUND
- `apps/web/lib/extract-attachment.test.ts` — FOUND
- `apps/web/lib/attachment-upload-rate-limit.ts` — FOUND
- `apps/web/lib/attachment-upload-rate-limit.test.ts` — FOUND
- `apps/web/app/api/runs/[id]/attachments/route.ts` — FOUND
- `apps/web/types/pdf-parse.d.ts` — FOUND
- `apps/web/lib/__fixtures__/tiny.pdf` — FOUND (1274 B)
- `apps/web/lib/__fixtures__/tiny.png` — FOUND (70 B)
- `apps/web/lib/__fixtures__/tiny.txt` — FOUND
- `apps/web/lib/__fixtures__/tiny.md` — FOUND
- `packages/db/src/scripts/migrate-17.ts` — FOUND
- `packages/db/src/schema/tenant.ts` — MODIFIED (`extractedText: text('extracted_text')` present at line 89)
- `apps/web/package.json` — MODIFIED (`"pdf-parse": "1.1.1"` present)
- Commit `f36a968` (Task 1 RED) — FOUND
- Commit `18cadb3` (Task 1 GREEN) — FOUND
- Commit `08cca66` (Task 2 RED) — FOUND
- Commit `0c65640` (Task 2 GREEN) — FOUND
- `corepack pnpm -F web exec tsc --noEmit` → exit 0
- `corepack pnpm --filter @beagle-console/db exec tsc --noEmit` → exit 0
- `corepack pnpm -F web exec vitest run` → 179/179 passing (was 165 before plan)

## TDD Gate Compliance

The plan declared `tdd="true"` on both tasks. Both gates fired correctly:

- **Task 1:** test commit `f36a968` (RED — `Cannot find module './extract-attachment'`, suite failed) → impl commit `18cadb3` (GREEN — 10 tests passing).
- **Task 2:** test commit `08cca66` (RED — `Cannot find module './attachment-upload-rate-limit'`, suite failed) → impl commit `0c65640` (GREEN — 4 tests passing, full suite 179 green, both tsc passes clean).

No REFACTOR commits required — both implementations were minimal-to-pass on the first GREEN pass.

---
*Phase: 17-attachments*
*Completed: 2026-04-28*
