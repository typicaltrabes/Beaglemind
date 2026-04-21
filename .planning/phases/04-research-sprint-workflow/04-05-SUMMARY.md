---
phase: 04-research-sprint-workflow
plan: 05
subsystem: ui
tags: [next-js, sidebar, project-management, sse, tanstack-query, zustand, dashboard]

requires:
  - phase: 04-research-sprint-workflow
    provides: "TanStack Query hooks, Zustand stores, SSE hook (Plan 04); API routes for projects, runs, streaming (Plan 03)"

provides:
  - "Dashboard layout with sidebar (project list + question queue) + QueryProvider wrapper"
  - "Project list sidebar component with active project highlighting and navigation"
  - "New project dialog with name + description form"
  - "Question queue sidebar section with unanswered count badge"
  - "Project detail page with run list, status badges, and new sprint form"
  - "Run page with live SSE transcript, composer, and stop button"

affects: [04-06]

tech-stack:
  added: []
  patterns: [sidebar-layout-with-scroll-area, client-component-pages-with-server-layout, status-badge-color-mapping]

key-files:
  created:
    - apps/web/components/sidebar/sidebar.tsx
    - apps/web/components/sidebar/project-list.tsx
    - apps/web/components/sidebar/new-project-dialog.tsx
    - apps/web/components/sidebar/question-queue.tsx
    - apps/web/app/(dashboard)/projects/[projectId]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx
  modified:
    - apps/web/app/(dashboard)/layout.tsx
    - apps/web/app/(dashboard)/page.tsx

key-decisions:
  - "Sidebar is a client component composed into server layout via QueryProvider wrapper"
  - "Dashboard page.tsx changed from server component to client component using useProjects()"
  - "Project and run pages use Next.js 15 async params pattern with use() hook"
  - "Run status badges use color mapping record for consistent styling across pages"

patterns-established:
  - "Sidebar: aside element with fixed width, ScrollArea, border-r separator"
  - "Page params: use(params) for Next.js 15 client component param unwrapping"
  - "Status colors: shared STATUS_STYLES record mapping run status to badge classes"

requirements-completed: [WORK-01, WORK-02, WORK-05, WORK-06]

duration: 3min
completed: 2026-04-21
---

# Phase 4 Plan 05: Dashboard UI Summary

**Dashboard shell with sidebar (project list, question queue, new project dialog), project detail page with run management and new sprint form, and run page with live SSE transcript and composer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T18:12:49Z
- **Completed:** 2026-04-21T18:16:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Dashboard layout updated with sidebar + main area flex structure, wrapped in QueryProvider
- Sidebar component with ProjectList (fetches via useProjects), QuestionQueue (reads Zustand), and NewProjectDialog
- New project dialog creates projects via useCreateProject mutation and navigates to new project page
- Question queue shows unanswered count badge with amber accent, links to run transcript
- Project detail page displays runs with status badges, allows starting new sprints via useStartRun
- Run page connects to SSE via useRunStream, renders live events, has composer and stop button
- All 6 run statuses have distinct badge colors (pending=gray, planned=yellow, approved=blue, executing=green-pulse, completed=green, cancelled=red)

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard layout with sidebar, project list, question queue, and new project dialog** - `62f2f98` (feat)
2. **Task 2: Project detail page with run management and run page with live SSE transcript** - `d38da67` (feat)

## Files Created/Modified
- `apps/web/components/sidebar/sidebar.tsx` - Sidebar wrapper with ScrollArea, composes ProjectList + QuestionQueue
- `apps/web/components/sidebar/project-list.tsx` - Project list using useProjects() with active highlighting and skeleton loading
- `apps/web/components/sidebar/new-project-dialog.tsx` - Dialog form with name + description, calls useCreateProject()
- `apps/web/components/sidebar/question-queue.tsx` - Unanswered questions from Zustand with badge count and run links
- `apps/web/app/(dashboard)/layout.tsx` - Updated with QueryProvider wrapper and Sidebar + main area flex layout
- `apps/web/app/(dashboard)/page.tsx` - Replaced placeholder with welcome screen and project list
- `apps/web/app/(dashboard)/projects/[projectId]/page.tsx` - Project page with run list, status badges, new sprint form
- `apps/web/app/(dashboard)/projects/[projectId]/runs/[runId]/page.tsx` - Run page with SSE connection, event transcript, composer, stop button

## Decisions Made
- Sidebar is a client component rendered inside server layout; QueryProvider wraps entire layout children
- Dashboard page.tsx changed from server component to client component to use useProjects() directly
- Project and run pages use Next.js 15 `use(params)` pattern for async param unwrapping
- Status badge colors use a shared record pattern for consistency across project and run pages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All navigation paths functional: dashboard -> project -> run
- Sidebar project list and question queue ready for real data
- Run page transcript area ready for Plan 06 enhanced components (scene organization, plan approval cards, etc.)
- Composer placeholder ready for Plan 06 to enhance with proper message handling

## Self-Check: PASSED
