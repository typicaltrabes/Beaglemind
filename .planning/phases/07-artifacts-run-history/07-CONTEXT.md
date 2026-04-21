# Phase 7: Artifacts & Run History - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish artifact management and add run history browsing. Phase 4 built the basic artifact card + download route + MinIO client. Phase 7 adds: bucket-per-tenant enforcement, inline docx/pdf preview, run history page with search and status filters, and per-run cost visibility from LiteLLM metrics.

</domain>

<decisions>
## Implementation Decisions

### MinIO Artifact Storage
- **D-01:** Bucket-per-tenant isolation enforced: bucket name = `tenant-{tenantId}`. Objects keyed as `runs/{runId}/artifacts/{filename}`.
- **D-02:** Upload flow: Hub receives artifact event from agent → stores file in MinIO → event includes `minioKey` field → frontend renders artifact card.
- **D-03:** Download: GET /api/artifacts/[id]/download generates MinIO presigned URL (5-min expiry) and redirects.

### Inline Preview
- **D-04:** PDF preview via browser-native PDF viewer (iframe with PDF URL). No external library needed.
- **D-05:** DOCX preview: convert to HTML server-side using `mammoth` library, render in a modal/panel. Fallback: download link if conversion fails.
- **D-06:** Preview opens in a slide-over panel from the artifact card. "View" button alongside "Download".

### Run History
- **D-07:** Dedicated run history page at /runs — lists all runs across all projects for the tenant. Also accessible per-project.
- **D-08:** Filters: status (pending/planned/approved/executing/completed/cancelled), date range. Search by project name or prompt text.
- **D-09:** Each run row shows: project name, prompt (truncated), status badge, cost, duration, artifact count, created date.
- **D-10:** Clicking a run navigates to the run page (Writers' Room transcript).

### Cost Visibility
- **D-11:** Per-run cost aggregated from event metadata `costUsd` field (already in process drawer from Phase 6). Run history shows total cost per run.
- **D-12:** Cost display format: "$X.XX" with color coding (green < $5, yellow $5-20, red > $20).

### Claude's Discretion
- mammoth configuration for docx conversion
- Presigned URL expiry time
- Run history pagination (infinite scroll vs page numbers)
- Search debounce timing
- Cost color threshold values

</decisions>

<canonical_refs>
## Canonical References

### Existing Code
- `apps/web/components/transcript/artifact-card.tsx` — Artifact card (extend with View button)
- `apps/web/app/api/artifacts/[id]/download/route.ts` — Download route (already built in Phase 4)
- `packages/db/src/minio-client.ts` — MinIO client (Phase 1)
- `packages/db/src/schema/tenant.ts` — Artifacts table (Phase 4)
- `apps/web/lib/stores/run-store.ts` — Event store with cost data
- `apps/web/components/studio/cost-section.tsx` — Cost display pattern (Phase 6)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Artifact card, download route, MinIO client all exist from Phase 4
- Cost aggregation pattern from Phase 6 process drawer
- TanStack Query hooks for data fetching
- shadcn/ui DataTable or simple table components

### Integration Points
- New run history page at apps/web/app/(dashboard)/runs/page.tsx
- Artifact card extends with "View" button for preview
- Preview panel as a new component
- API route for docx→HTML conversion

</code_context>

<specifics>
## Specific Ideas

No specific wireframe for run history page — keep it simple and consistent with the dark theme.

</specifics>

<deferred>
## Deferred Ideas

- Artifact versioning (multiple drafts per run) — v2
- Bulk artifact download (zip) — v2

</deferred>

---

*Phase: 07-artifacts-run-history*
*Context gathered: 2026-04-21*
