---
phase: 07-artifacts-run-history
plan: 01
subsystem: ui
tags: [mammoth, docx, pdf, preview, slide-over, base-ui, minio]

requires:
  - phase: 04-research-sprint-workflow
    provides: artifact card, download route, MinIO client, artifacts table
provides:
  - DOCX-to-HTML preview API route via mammoth
  - Slide-over preview panel for inline PDF/DOCX viewing
  - Extended artifact card with View + Download buttons
affects: [07-artifacts-run-history]

tech-stack:
  added: [mammoth]
  patterns: [base-ui Dialog as slide-over panel, type-discriminated preview JSON response]

key-files:
  created:
    - apps/web/app/api/artifacts/[id]/preview/route.ts
    - apps/web/components/transcript/artifact-preview-panel.tsx
  modified:
    - apps/web/components/transcript/artifact-card.tsx

key-decisions:
  - "Used @base-ui/react Dialog (not shadcn Sheet) for slide-over panel to match existing UI primitive pattern"
  - "Preview API returns 200 with type:'error' on conversion failure instead of 500 for graceful frontend handling"

patterns-established:
  - "Slide-over panel: Dialog primitive with slide-in-from-right animation, 60% width on desktop"
  - "Type-discriminated JSON response: { type: 'pdf'|'docx'|'unsupported'|'error', ...data } for extensible preview support"

requirements-completed: [ARTF-01, ARTF-02, ARTF-03]

duration: 2min
completed: 2026-04-21
---

# Phase 7 Plan 1: Artifact Inline Preview Summary

**Inline PDF/DOCX artifact preview via slide-over panel using mammoth conversion and base-ui Dialog**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T19:19:32Z
- **Completed:** 2026-04-21T19:21:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Preview API route at /api/artifacts/[id]/preview with type-discriminated JSON for PDF (presigned URL), DOCX (mammoth HTML), and unsupported types
- Slide-over preview panel built on @base-ui/react Dialog primitive with right-side slide animation
- Artifact card extended with View button for previewable mime types (PDF, DOCX), Download button unchanged for all types

## Task Commits

Each task was committed atomically:

1. **Task 1: DOCX preview API route + install mammoth** - `20e8f60` (feat)
2. **Task 2: Artifact preview panel + extend artifact card with View button** - `a2bddee` (feat)

## Files Created/Modified
- `apps/web/app/api/artifacts/[id]/preview/route.ts` - Preview API: PDF returns presigned URL, DOCX converts via mammoth, graceful error handling
- `apps/web/components/transcript/artifact-preview-panel.tsx` - Slide-over panel: iframe for PDF, dangerouslySetInnerHTML for DOCX HTML, loading skeleton, fallback states
- `apps/web/components/transcript/artifact-card.tsx` - Extended with View button (previewable types only) and ArtifactPreviewPanel integration
- `apps/web/package.json` - Added mammoth dependency

## Decisions Made
- Used @base-ui/react Dialog as slide-over primitive instead of installing shadcn Sheet -- project already uses base-ui for all UI primitives, no reason to add a different component library
- Preview API returns 200 with `{ type: 'error', message }` on mammoth conversion failure rather than 500 -- frontend handles gracefully with download fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Artifact preview complete, ready for plan 07-02 (run history page)
- All ARTF requirements satisfied

## Self-Check: PASSED

- All 3 created/modified files exist on disk
- Both task commits verified: 20e8f60, a2bddee
- artifact-preview-panel.tsx: 147 lines (min 60)
- artifact-card.tsx: 106 lines (min 50)
- key_links verified: ArtifactPreviewPanel imported in artifact-card, fetch to /api/artifacts preview route in panel, iframe for PDF download

---
*Phase: 07-artifacts-run-history*
*Completed: 2026-04-21*
