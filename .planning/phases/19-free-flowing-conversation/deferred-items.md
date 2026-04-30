# Phase 19 — Deferred Items

Out-of-scope discoveries during execution. Track here, fix in a follow-up plan.

## From Plan 19-03 execution (2026-04-30)

### Pre-existing test failure: user-message-attachments.test.tsx

**File:** `apps/web/components/transcript/user-message-attachments.test.tsx`

**Failing test:** `renders an inline <img> using the download URL for image/png attachments`

**Cause:** Phase 18-01 commit `487387a` ("stream artifacts through web app instead of redirecting to internal MinIO") added `?inline=1` query parameter to the inline image src URL in production code, but the test fixture was not updated. The test expects `/api/artifacts/{id}/download` but production now emits `/api/artifacts/{id}/download?inline=1`.

**Detected during:** Plan 19-03 Task 3 verification (full apps/web vitest run).

**Out of scope because:** Plan 19-03 does not touch `user-message-attachments.tsx` or its test file; the failure pre-dates this plan.

**Fix:** Update the test expectation to include `?inline=1`. One-line change in the test. Recommend a tiny follow-up plan or fold into the next phase that touches transcript attachment rendering.
