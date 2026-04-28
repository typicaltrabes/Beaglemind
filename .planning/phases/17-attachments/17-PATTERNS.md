# Phase 17: User Attachments — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 12 (8 new, 4 modified)
**Source of truth:** `17-CONTEXT.md` (no RESEARCH.md — `--skip-research` was used)

## Pre-flight Corrections to CONTEXT.md

Two factual gaps the planner must surface to executors:

1. **`pdf-parse` is NOT installed.** CONTEXT.md states "`pdf-parse` and `mammoth` are already in the repo (Phase 7)" — this is wrong. `apps/web/package.json` has only `"mammoth": "^1.12.0"`. `pdf-parse` will be a net-new dependency. Either (a) add it to `apps/web/package.json` (still arguably zero "new top-level deps" since the executor is fixing a CONTEXT-stated gap), or (b) skip PDF text extraction in V1 and let the agent see only the filename + size for PDFs (downgrade — image-mode for PDFs is awkward; recommend (a)).
2. **The MinIO helper lives at `packages/db/src/minio-client.ts`, not `apps/web/lib/minio.ts`.** It is re-exported from `@beagle-console/db` and consumed via `import { getMinioClient } from '@beagle-console/db'`. CONTEXT.md's path is wrong; the symbol/usage is right. See `apps/web/app/api/artifacts/[id]/preview/route.ts:5` for the canonical import line.

Both are recoverable in a few keystrokes during execution; flagging here so the planner doesn't ship a plan that says "import from `lib/minio.ts`."

---

## File Classification

| File | New/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|--------------|------|-----------|----------------|---------------|
| `apps/web/components/transcript/composer.tsx` | modified | component | event-driven (UI) | self (existing file) | exact |
| `apps/web/components/transcript/attachment-chip.tsx` | new | component | request-response | `apps/web/components/transcript/artifact-card.tsx` | role-match |
| `apps/web/lib/attachment-upload.ts` | new | utility (client) | request-response | `apps/web/lib/litellm-client.ts` | role-match |
| `apps/web/app/api/runs/[id]/attachments/route.ts` | new | route (POST, multipart) | file-I/O + CRUD | `apps/web/app/api/artifacts/[id]/preview/route.ts` + `apps/web/app/api/runs/route.ts` | role-match (composite) |
| `apps/web/lib/extract-attachment.ts` | new | utility (server) | transform | `apps/web/app/api/artifacts/[id]/preview/route.ts` (mammoth call) | partial |
| `apps/web/lib/extract-attachment.test.ts` | new | test | — | (no in-repo vitest analog with file fixtures yet — use `apps/web/lib/litellm-client.test.ts` shape) | partial |
| `packages/db/src/schema/tenant.ts` | modified | model (Drizzle) | — | self (existing file, line 81-90 artifacts table) | exact |
| `packages/db/src/scripts/migrate-17.ts` | new | migration script | batch | `packages/db/src/scripts/migrate-13.ts` | exact |
| `apps/web/app/api/runs/[id]/messages/route.ts` | modified | route | request-response | self | exact |
| `apps/agent-hub/src/http/routes.ts` | modified | route + orchestrator | request-response + event-driven | self (lines 119-250 round-table) | exact |
| `apps/agent-hub/src/connections/openclaw-cli-bridge.ts` | modified (DEFER if complex) | bridge | request-response (shell) | self | exact |
| `packages/shared/src/hub-events.ts` | modified | model (Zod) | — | self | exact |

---

## Pattern Assignments

### `apps/web/components/transcript/composer.tsx` (modified)

**Analog:** itself — extending in place. Match the existing toolbar/icon-button conventions.

**Existing icon-button pattern** (composer.tsx:248-261, the Improve / Sparkles button is the slot-mate to the new paperclip):
```tsx
<div className="flex shrink-0 gap-1.5">
  <Button
    ref={improveButtonRef}
    type="button"
    variant="ghost"
    size="sm"
    onClick={() => setImproveOpen(true)}
    disabled={!input.trim() || isCancelled || isPlanned}
    aria-label="Improve prompt"
    title="Improve prompt"
  >
    <Sparkles className="size-4" />
  </Button>
```
→ Insert `Paperclip` button between this `<Button>` and the Stop/Send block, same `variant="ghost" size="sm"`, `Paperclip` from `lucide-react` (already imported alongside `GitFork, Sparkles, X` on line 4).

**Existing dismissable-chip pattern** (composer.tsx:154-166, the @-mention badge — closest visual analog to a pending-attachment chip):
```tsx
<span
  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_CONFIG[targetAgent]?.nameColor ?? 'text-gray-400'} bg-white/5`}
>
  @{AGENT_CONFIG[targetAgent]?.displayName ?? targetAgent}
  <button
    type="button"
    onClick={clearTarget}
    className="ml-0.5 cursor-pointer rounded-full p-0.5 hover:bg-white/10"
  >
    <X className="size-3" />
  </button>
</span>
```
→ AttachmentChip should adopt this shape (rounded, `bg-white/5`, `<X className="size-3" />` remove button). CONTEXT specifies `rounded-md` (not `rounded-full`) for chips — keep that distinction.

**Send-button disable pattern** (composer.tsx:285-291):
```tsx
<Button size="sm" onClick={handleSend} disabled={!canSend || sendMessage.isPending}>
  {sendMessage.isPending ? 'Sending...' : 'Send'}
</Button>
```
→ Extend `canSend` to also require `attachments.every(a => a.status === 'ready')` — keep the boolean composition local to the component, don't push it into Zustand (CONTEXT decision).

**State convention** — local `useState`, NOT Zustand. CONTEXT decision is explicit ("Local-only state, not in Zustand"). The existing composer already keeps `input`, `mentionOpen`, `targetAgent`, `verbosity`, `improveOpen` as local `useState` — follow suit:
```tsx
const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
```

---

### `apps/web/components/transcript/attachment-chip.tsx` (new)

**Analog:** the @-mention badge inside `composer.tsx` (above) for layout, plus `apps/web/components/transcript/artifact-card.tsx` for `formatSize` and the file-icon SVG.

**Reusable size formatter to copy verbatim** (artifact-card.tsx:19-23):
```tsx
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```
→ Extract to `apps/web/lib/format-size.ts` if Plan 17-01 also wants it client-side, or duplicate (it's 4 lines).

**File icon SVG** — artifact-card.tsx:42-56 already has a clean inline file-icon SVG. Reuse the same shape so the pending-chip and the post-send `ArtifactCard` look like the same artifact at different lifecycle stages.

**Status-icon convention** — use `lucide-react` (CONTEXT decision):
- `uploading` → `Loader2` with `animate-spin`
- `ready` → `Check`
- `error` → `AlertCircle` (text-red-500)

---

### `apps/web/lib/attachment-upload.ts` (new client helper)

**Analog:** `apps/web/lib/litellm-client.ts` (a thin client-helper wrapping `fetch` with typed response + custom error class).

**Pattern to copy** (litellm-client.ts pattern, applied to multipart upload):
```ts
export class AttachmentUploadError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AttachmentUploadError';
  }
}

export async function uploadAttachment(
  runId: string,
  file: File,
): Promise<{ artifactId: string; filename: string; mimeType: string; sizeBytes: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/runs/${runId}/attachments`, {
    method: 'POST',
    body: fd, // do NOT set Content-Type — browser sets multipart boundary
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new AttachmentUploadError(res.status, (err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}
```

The `apps/web/lib/api/hub-client.ts` `hubPost` function (lines 3-14) is the project's canonical "fetch + typed-error + JSON" wrapper — same shape, just adapted for multipart instead of `JSON.stringify`.

---

### `apps/web/app/api/runs/[id]/attachments/route.ts` (new POST endpoint)

**Analog (composite):**
- `apps/web/app/api/runs/route.ts` for the auth-scoped POST handler shape, Zod parsing, error handling.
- `apps/web/app/api/artifacts/[id]/preview/route.ts` for the MinIO + `getTenantDb` artifact-row pattern.
- `apps/web/app/api/runs/improve-prompt/route.ts` for in-handler rate-limiting (the `<threat_model>` bullet in CONTEXT specifies "in-handler rate-limit at 10 req/min/user").

**Auth + schema-fetch pattern** (preview/route.ts:18-29 — copy verbatim shape):
```ts
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requireTenantContext();
    const { id: runId } = await params;
    const { db: tdb, schema } = getTenantDb(tenantId);
    // ... handler body ...
  } catch (error) {
    console.error('POST /api/runs/[id]/attachments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Multipart parsing** (Next 15) — no in-repo precedent; the canonical idiom is:
```ts
const formData = await request.formData();
const file = formData.get('file');
if (!(file instanceof File)) {
  return NextResponse.json({ error: 'file field required' }, { status: 400 });
}
```

**Validation** — mirror the Zod-on-`runs/route.ts:10-14` pattern but for the parsed File metadata:
```ts
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp',
  'text/plain', 'text/markdown',
]);
const MAX_SIZE = 20 * 1024 * 1024;
if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: 'unsupported type' }, { status: 400 });
if (file.size > MAX_SIZE) return NextResponse.json({ error: 'file too large' }, { status: 400 });
```

**MinIO upload** — preview route only reads via `GetObjectCommand`. The new endpoint needs `PutObjectCommand`, which is NOT used anywhere in-repo today (grep confirmed). Use the same `getMinioClient()` import and bucket convention `tenant-${tenantId}`:
```ts
import { getMinioClient } from '@beagle-console/db';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const ext = file.name.split('.').pop() ?? 'bin';
const minioKey = `runs/${runId}/uploads/${randomUUID()}.${ext}`;
const buf = Buffer.from(await file.arrayBuffer());
await getMinioClient().send(new PutObjectCommand({
  Bucket: `tenant-${tenantId}`,
  Key: minioKey,
  Body: buf,
  ContentType: file.type,
}));
```

**Insert into artifacts table** — the schema lives at `packages/db/src/schema/tenant.ts:81-90`, and `runs/route.ts:46-55` shows the canonical Drizzle insert + `.returning()` pattern:
```ts
const [row] = await tdb
  .insert(schema.artifacts)
  .values({
    runId,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    minioKey,
    agentId: 'user',
    extractedText, // from extract-attachment.ts; nullable
  })
  .returning();
return NextResponse.json({
  artifactId: row.id,
  filename: row.filename,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
});
```

**Rate-limit pattern** (improve-prompt/route.ts:24-29) — duplicate the per-user in-memory limiter under a new key, or generalize `improve-prompt-rate-limit.ts` to take a key/limit. Suggest a sibling file `apps/web/lib/attachment-upload-rate-limit.ts`:
```ts
if (!rateLimitOk(session.user.id)) {
  return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 });
}
```

---

### `apps/web/lib/extract-attachment.ts` (new server module)

**Analog:** `apps/web/app/api/artifacts/[id]/preview/route.ts:46-74` for the `mammoth` invocation. PDF extraction has no in-repo precedent — the standard `pdf-parse` API is `pdfParse(buffer).then(data => data.text)`.

**DOCX pattern to copy** (preview/route.ts:63-65):
```ts
const result = await mammoth.convertToHtml({ buffer: Buffer.from(bodyBytes) });
```
For extraction, swap to the rawText variant:
```ts
import mammoth from 'mammoth';
const { value } = await mammoth.extractRawText({ buffer });
```

**Function shape (recommended):**
```ts
export const EXTRACT_CAP = 50_000;

export async function extractAttachment(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  try {
    let text: string | null = null;
    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default; // dynamic import avoids bundling cost on cold start of unrelated routes
      const { text: pdfText } = await pdfParse(buffer);
      text = pdfText;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      text = buffer.toString('utf-8');
    } else {
      return null; // images: vision model handles it
    }
    if (text && text.length > EXTRACT_CAP) {
      text = text.slice(0, EXTRACT_CAP) + `\n\n[... truncated, original ${buffer.length} bytes ...]`;
    }
    return text;
  } catch (err) {
    console.warn('extractAttachment failed:', err);
    return null; // CONTEXT: extraction failure → log warning, store NULL, still upload
  }
}
```

The `try/catch → log + return null` failure-mode mirrors preview/route.ts:48-74 (the DOCX try/catch returns a "Preview unavailable" payload instead of crashing).

---

### `apps/web/lib/extract-attachment.test.ts` (new)

No in-repo vitest test exercises file fixtures yet. Closest analog for the test file shape: `apps/web/lib/litellm-client.test.ts` (mocks `fetch`, asserts behavior). For attachment extraction, the tests should:

- Use real small fixtures committed under `apps/web/lib/__fixtures__/` (e.g. `tiny.pdf`, `tiny.docx`, `tiny.txt`).
- One test per branch: pdf-text-extracted, docx-text-extracted, txt-utf8, md-utf8, png-skip-returns-null, jpeg-skip-returns-null, oversized-truncation (synthesize a >50K-char buffer for `text/plain`), malformed-pdf-returns-null (use a non-PDF buffer with PDF mime).

Test setup convention (from `boardroom-grid.test.ts`, `canvas-utils.test.ts` etc.):
```ts
import { describe, it, expect } from 'vitest';
```
Standard `vitest` — no special framework setup needed.

---

### `packages/db/src/schema/tenant.ts` (modified)

**Analog:** the existing `artifacts` table definition (lines 81-90) — add one line:

```ts
const artifacts = schema.table('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  minioKey: text('minio_key').notNull(),
  agentId: text('agent_id').notNull(),
  extractedText: text('extracted_text'),  // NEW — nullable
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```
Nullable (no `.notNull()`) because images and extraction-failures persist NULL.

---

### `packages/db/src/scripts/migrate-17.ts` (new)

**Analog:** `packages/db/src/scripts/migrate-13.ts` — copy the file structure verbatim, swap the operations.

**Pattern to copy** (migrate-13.ts:29-79):
```ts
export async function migratePhase17() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  try {
    // Source-of-truth is shared.organizations (NOT shared.tenants — Phase 14 fix).
    const tenantRows = (await db.execute(
      sql`SELECT id FROM shared.organizations`,
    )) as unknown as { id: string }[];

    for (const row of tenantRows) {
      const schemaName = `tenant_${row.id.replace(/-/g, '_')}`;
      try {
        await db.execute(sql`
          ALTER TABLE ${sql.identifier(schemaName)}.artifacts
          ADD COLUMN IF NOT EXISTS extracted_text text
        `);
        console.log(`Added ${schemaName}.artifacts.extracted_text`);
      } catch (err) {
        console.error(`Failed migration step for ${schemaName}:`, err);
      }
    }
    console.log(`Phase 17 migration complete (${tenantRows.length} tenants).`);
  } finally {
    await client.end();
  }
}

if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  migratePhase17().catch((err) => {
    console.error('Phase 17 migration failed:', err);
    process.exit(1);
  });
}
```

Key rules already in migrate-13:
- `ADD COLUMN IF NOT EXISTS` (idempotent re-run).
- Per-tenant `try/catch` so one bad tenant doesn't block the rest.
- Read tenants from `shared.organizations`, NOT `shared.tenants`.
- Sanitize tenant id: `replace(/-/g, '_')`.
- Run via `pnpm --filter @beagle-console/db exec tsx src/scripts/migrate-17.ts`.

---

### `apps/web/app/api/runs/[id]/messages/route.ts` (modified)

**Analog:** itself — extend the existing POST handler at lines 47-79.

**Current Zod body:**
```ts
const SendMessageBody = z.object({
  content: z.string().min(1),
});
```

**Phase 17 extension:**
```ts
const SendMessageBody = z.object({
  content: z.string().min(1),
  attachmentIds: z.array(z.string().uuid()).max(4).default([]),
});
```

**Attachment lookup + prompt-prepend**, splice between the existing line 57 (`const { content } = SendMessageBody.parse(body)`) and the existing line 68 (`await hubClient.startRun({...})`):
```ts
let attachmentBlock = '';
let hubAttachments: Array<{ filename: string; mimeType: string; sizeBytes: number; extractedText: string | null; base64?: string }> = [];

if (attachmentIds.length > 0) {
  const rows = await tdb
    .select()
    .from(schema.artifacts)
    .where(inArray(schema.artifacts.id, attachmentIds));
  // Optional: assert each row.runId === runId and row.agentId === 'user' to prevent cross-run reuse.
  // For images: fetch object bytes from MinIO and base64-encode (defer if image-via-CLI-bridge is deferred).
  // Build the textual block:
  const lines = ['--- USER ATTACHMENTS ---'];
  rows.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.filename} (${r.mimeType}, ${formatSize(r.sizeBytes)})`);
    if (r.extractedText) lines.push(r.extractedText);
    else if (r.mimeType.startsWith('image/')) lines.push('(image — included with this message)');
    else lines.push('(no extracted text available)');
  });
  lines.push('--- END ATTACHMENTS ---');
  attachmentBlock = lines.join('\n') + '\n\n';
  hubAttachments = rows.map(r => ({ filename: r.filename, mimeType: r.mimeType, sizeBytes: r.sizeBytes, extractedText: r.extractedText, /* base64 if image and pass-through is wired */ }));
}

await hubClient.startRun({
  runId,
  tenantId,
  prompt: attachmentBlock + content,  // simplest path: prepend in the web app
  // OR pass attachments as a separate field if hub-events.ts is extended (CONTEXT Track 3)
});
```

The CONTEXT.md leaves both options open ("prepend in web app" vs "pass attachments as a separate field on the hub payload"). Recommend the planner pick **prepend in the web app** for V1 because it requires no `hub-events.ts` schema change AND no `hubClient` signature change AND no hub-side logic change. Defer the structured-attachments-on-hub path to the image-base64 work where the hub genuinely needs the bytes.

**`inArray` import** — comes from `drizzle-orm`, alongside the existing `eq, asc` on line 2.

---

### `apps/agent-hub/src/http/routes.ts` (modified)

**Analog:** itself — `runRoundTable` at lines 155-250 is the splice site.

**If "prepend in web app" approach is chosen** (recommended) — NO changes here. The `userPrompt` parameter (line 158) already arrives prefixed; the existing `[SYSTEM] You are on the Beagle Agent Console...` group context still wraps cleanly:
```ts
fullPrompt = `${groupContext}\n\nUser: ${userPrompt}\n\n${displayName}, you're first to respond.`;
```
The attachments block sits inside `userPrompt`, BEFORE the round-table wrapping — which matches CONTEXT's stated requirement ("prepend BEFORE the user prompt, not after").

**If "structured attachments on hub payload" approach is chosen** — extend `RunStartBody` Zod (lines 29-34) and splice the block-builder ABOVE the `groupContext` definition at line 179. Note: this requires a parallel change to `packages/shared/src/hub-events.ts` AND `apps/web/lib/api/hub-client.ts` `startRun` signature.

**Image base64 pass-through (DEFER if complex):** the OpenClaw CLI bridge today shells out via `openclaw agent --message '${escapedMessage}' --json` (openclaw-cli-bridge.ts:22-25). The `--message` flag accepts only a string. To send images, either (a) the CLI gets a new `--image-base64` flag/repeated arg, or (b) the message string itself encodes the image as a base64 data URI inline (model-dependent — Anthropic accepts inline images via the API but the CLI may not surface this). CONTEXT's textual fallback `(image attached: ${filename} — vision-pass not yet wired)` is the safe ship-it-now path. Add this fallback string in `runRoundTable` if the image attachment is detected.

---

### `apps/agent-hub/src/connections/openclaw-cli-bridge.ts` (modified — DEFER)

**Analog:** itself. Today (lines 22-25):
```ts
const openclawCmd = cfg.sudoUser
  ? `sudo -u ${cfg.sudoUser} openclaw agent --message '${escapedMessage}' --session-id '${sessionId}' --agent main --json 2>/dev/null`
  : `openclaw agent --message '${escapedMessage}' --session-id '${sessionId}' --agent main --json 2>/dev/null`;
```

CONTEXT explicitly defers image-via-CLI-bridge if it exceeds 30 min. Recommend the planner schedules this as the LAST plan in the phase, with a hard time-box and a fallback to ship the textual `(image attached: …)` placeholder instead. No code excerpt to copy — this is a CLI-flag exploration task ("does `openclaw agent --help` expose anything for content blocks?"), not a coding task.

---

### `packages/shared/src/hub-events.ts` (modified — only if structured-attachments approach chosen)

**Analog:** itself, lines 62-72 (`OpenClawOutbound`). To extend the hub start-run payload, add a sibling Zod schema:
```ts
export const HubAttachment = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  extractedText: z.string().nullable(),
  base64: z.string().optional(),
});
export type HubAttachment = z.infer<typeof HubAttachment>;
```
Then update the (currently web-app-internal) `RunStartBody` in `apps/agent-hub/src/http/routes.ts:29-34` to include `attachments: z.array(HubAttachment).max(4).default([])`.

If the planner chooses the simpler "prepend in web app" approach, this file does NOT change.

---

## Shared Patterns

### Auth-scope (every new server route)
**Source:** `apps/web/lib/get-tenant.ts:18-49`
**Apply to:** `app/api/runs/[id]/attachments/route.ts`

```ts
import { requireTenantContext, getTenantDb } from '@/lib/get-tenant';
const { tenantId } = await requireTenantContext();
const { db: tdb, schema } = getTenantDb(tenantId);
```
This is the project's universal "auth + tenant-scoped Drizzle" two-liner. Used in 100% of API routes touching tenant data (verified across `runs/route.ts`, `runs/[id]/messages/route.ts`, `artifacts/[id]/{preview,download}/route.ts`, `improve-prompt/route.ts`).

### Error response shape
**Apply to:** all new routes
```ts
return NextResponse.json({ error: '...' }, { status: 400 | 404 | 429 | 500 });
```
Always plain `{ error: string }`. Status code conveys class. See every route in `apps/web/app/api/`.

### `runtime = 'nodejs'`
**Apply to:** all new routes that touch DB / MinIO / mammoth / pdf-parse.
```ts
export const runtime = 'nodejs';
```
Mandatory; Edge runtime cannot run the postgres driver, AWS SDK, or `mammoth`. Verified at top of every existing API route.

### MinIO bucket convention
**Source:** `packages/db/src/minio-client.ts` + `apps/web/app/api/artifacts/[id]/preview/route.ts:40`
```ts
Bucket: `tenant-${tenantId}`
Key:    `runs/${runId}/uploads/${randomUUID()}.${ext}`  // CONTEXT decision
```
The bucket is created at provisioning time by `ensureBucket()` (minio-client.ts:27-35), so the route handler can assume it exists.

### Zod validation idiom
**Source:** `apps/web/app/api/runs/route.ts:10-14`, `improve-prompt/route.ts:16-18`
```ts
import { z } from 'zod/v4';
const Body = z.object({ /* ... */ });
const parsed = Body.parse(body);
// On ZodError, return 400:
if (error instanceof z.ZodError) {
  return NextResponse.json({ error: error.message }, { status: 400 });
}
```
Note: the project standardizes on `'zod/v4'` (the zod-v4 namespaced import), NOT bare `'zod'`. Verified across all routes.

### Tailwind tokens
**Apply to:** AttachmentChip, composer drag-drop ring
- `text-foreground`, `text-muted-foreground`
- `bg-card`, `bg-white/5` (subtle), `bg-muted`
- `border-white/10`, `border-border`
- Active/highlight: `ring-2 ring-amber-500/50` (matches the existing amber accent on the verbosity slider — composer.tsx:183 `accent-amber-500`)
- Chip: `inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-xs` (per CONTEXT decision)

### lucide-react icons
**Apply to:** all new icon usages
- `Paperclip` (paperclip button — net-new import in composer.tsx:4)
- `Loader2`, `Check`, `AlertCircle` (attachment-chip status)
- `X` (already imported in composer.tsx for chip-remove)

### File-size formatter (cross-cutting)
**Source:** `apps/web/components/transcript/artifact-card.tsx:19-23` — already canonical. Either dedupe to `apps/web/lib/format-size.ts` or duplicate (4 lines).

---

## No Analog Found

| File | Why no in-repo analog |
|------|------------------------|
| `app/api/runs/[id]/attachments/route.ts` (multipart receive) | No existing route in this repo accepts `multipart/form-data` — every existing POST is JSON. Use Next 15's stock `await request.formData()` + `formData.get('file') as File` idiom. |
| MinIO `PutObjectCommand` | No existing route uploads to MinIO from the web app — every existing usage is `GetObjectCommand` for read/presign. AWS SDK v3 `PutObjectCommand` is standard; just import it from `@aws-sdk/client-s3`. |
| `pdf-parse` invocation | Not in the codebase today (despite CONTEXT's claim). Standard API: `const { default: pdfParse } = await import('pdf-parse'); const { text } = await pdfParse(buffer);`. The `apps/web/package.json` will need `"pdf-parse": "^1.1.1"` added (or executor must propose an alternative). |
| OpenClaw CLI image-block invocation | Bridge today is string-only. Defer per CONTEXT; no in-repo precedent. |

The planner should call out `pdf-parse` as a hard dep gap in the Phase 17 deploy plan and either (a) add it to `apps/web/package.json`, or (b) ship without PDF text extraction and document the gap for Phase 18.

---

## Metadata

**Analog search scope:** `apps/web/`, `apps/agent-hub/`, `packages/db/`, `packages/shared/`
**Files scanned:** ~30 (every route under `apps/web/app/api/`, every helper in `apps/web/lib/`, hub routes + bridges, all schema files)
**Pattern extraction date:** 2026-04-28
