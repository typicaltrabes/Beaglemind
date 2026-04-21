---
phase: 10-mobile-pwa
plan: 03
subsystem: ui
tags: [mobile, pwa, question-queue, digest, quick-answer, lastActiveAt]

# Dependency graph
requires:
  - phase: 10-mobile-pwa
    provides: Responsive mobile layout (10-01), PWA manifest and push notifications (10-02)
provides:
  - Mobile landing page at /mobile with greeting, question queue, and digest
  - QuestionCard with inline yes/no quick-answer buttons
  - DigestView showing activity since last visit
  - GET /api/digest endpoint returning tenant-scoped activity summary
  - lastActiveAt column on users table
affects: [10-mobile-pwa]

# Tech tracking
tech-stack:
  added: []
  patterns: [yes/no question detection via regex patterns, lastActiveAt-based digest generation]

key-files:
  created:
    - apps/web/app/(dashboard)/mobile/page.tsx
    - apps/web/app/(dashboard)/mobile/layout.tsx
    - apps/web/components/mobile/question-card.tsx
    - apps/web/components/mobile/digest-view.tsx
    - apps/web/app/api/digest/route.ts
    - apps/web/lib/hooks/use-digest.ts
  modified:
    - packages/db/src/schema/auth-schema.ts

key-decisions:
  - "Yes/no detection via regex patterns on question text (Should, Do you want, Can we, etc.) plus content.type check"
  - "lastActiveAt updated server-side on each digest fetch (not on page load) to avoid race conditions"
  - "Digest query limits results to 50 per category to bound response size"

patterns-established:
  - "QuestionCard answered state: local useState for immediate UI feedback, Zustand optimistic update for store sync"
  - "Digest on-demand pattern: query since lastActiveAt, update lastActiveAt after query"

requirements-completed: [MOBI-04, MOBI-05]

# Metrics
duration: 3min
completed: 2026-04-21
---

# Phase 10 Plan 03: Mobile Landing Page with Question Queue and Digest Summary

**Mobile landing page with time-of-day greeting, question queue cards with inline yes/no quick-answer, and overnight digest showing activity since last visit**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T20:07:01Z
- **Completed:** 2026-04-21T20:10:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Mobile landing page at /mobile with "Good morning/afternoon/evening, [firstName]" greeting
- Question queue renders QuestionCard components from Zustand run store unansweredQuestions
- QuestionCard detects yes/no questions and shows inline Yes/No buttons that submit via useAnswerQuestion
- Open-ended questions show "View & Answer" link to full run page
- GET /api/digest endpoint queries tenant schema for runs, artifacts, and questions since lastActiveAt
- DigestView renders organized sections with status badges, file sizes, and relative timestamps
- Empty state, loading skeleton, and pending questions amber callout all handled
- lastActiveAt column added to users table for tracking last visit

## Task Commits

Each task was committed atomically:

1. **Task 1: Mobile landing page with question queue cards and quick-answer** - `12fc569` (feat)
2. **Task 2: Overnight digest API and view component** - `772eac0` (feat)

## Files Created/Modified
- `apps/web/app/(dashboard)/mobile/page.tsx` - Mobile landing page with greeting, question queue, digest
- `apps/web/app/(dashboard)/mobile/layout.tsx` - Thin passthrough layout (dashboard shell already provided by parent)
- `apps/web/components/mobile/question-card.tsx` - Question card with yes/no inline buttons and open-ended link
- `apps/web/components/mobile/digest-view.tsx` - Overnight digest with runs, artifacts, questions sections
- `apps/web/app/api/digest/route.ts` - GET endpoint returning activity summary since lastActiveAt
- `apps/web/lib/hooks/use-digest.ts` - TanStack Query hook with DigestData types and 5min staleTime
- `packages/db/src/schema/auth-schema.ts` - Added lastActiveAt timestamp column to users table

## Decisions Made
- Yes/no detection uses regex patterns on question text plus content.type === 'yes_no' for flexibility
- lastActiveAt updated server-side after digest query completes (not on page load) to ensure accurate window
- Digest response truncates long text fields to 120 chars for mobile bandwidth efficiency
- Digest limits to 50 items per category to bound response size

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
The lastActiveAt column must be added to the users table via migration. Existing users will have NULL lastActiveAt, which defaults to 24 hours ago for their first digest.

## Next Phase Readiness
- Mobile landing page complete with question queue and digest
- All three Phase 10 plans are now complete (responsive layout, PWA/push, mobile landing)

---
*Phase: 10-mobile-pwa*
*Completed: 2026-04-21*
