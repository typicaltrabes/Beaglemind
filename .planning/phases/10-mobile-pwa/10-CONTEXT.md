# Phase 10: Mobile PWA - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the console installable as a PWA with push notifications for governance events (plan approval, question queue) and a mobile-optimized question queue + overnight digest view.

</domain>

<decisions>
## Implementation Decisions

### PWA Setup
- **D-01:** PWA manifest + service worker via Serwist (next-pwa successor). App shell caching for offline loading.
- **D-02:** Install prompt: browser-native "Add to Home Screen". Custom install banner not needed for Year 1.
- **D-03:** Icons: Beagle gold on dark background, multiple sizes (192, 512). Simple "B" or beagle silhouette.

### Responsive Layout
- **D-04:** Tailwind responsive breakpoints. Mobile: sidebar collapses to hamburger menu. Transcript goes full-width. Composer sticks to bottom.
- **D-05:** Process drawer hidden on mobile (Studio mode available but drawer opens as full-screen overlay).

### Push Notifications
- **D-06:** Web Push via VAPID keys. Service worker handles push events. Notification shows: "Mo needs approval: [plan name]" or "Question from Jarvis: [question preview]".
- **D-07:** Push subscription stored in user record (shared schema). Subscribe on first login, update on re-login.
- **D-08:** Hub triggers push: when plan_proposal or question event fires, Hub calls a notification service that sends web push to subscribed users in the tenant.
- **D-09:** Notification click opens the relevant run page.

### Mobile Question Queue
- **D-10:** Mobile landing screen (when installed as PWA): "Good morning, [name]" header, question queue cards with quick-answer buttons, overnight digest below.
- **D-11:** Quick answer: for yes/no questions, show inline buttons. For open-ended, tap opens the full run page.

### Overnight Digest
- **D-12:** Digest view: summary of what happened while user was away. Lists runs that progressed, artifacts delivered, questions answered.
- **D-13:** Generated on-demand when user opens the app (not pre-computed). Queries events since last_active_at on the user record.

### Claude's Discretion
- Serwist configuration details
- VAPID key generation and storage
- Push notification service architecture (inline vs BullMQ job)
- Digest query optimization
- Offline fallback page content

</decisions>

<canonical_refs>
## Canonical References

### Wireframes
- Wireframes HTML — Mobile tab (tab 6): question queue cards, digest view, mobile transcript

### Existing Code
- `apps/web/components/sidebar/question-queue.tsx` — Question queue (reuse for mobile)
- `apps/web/lib/hooks/use-projects.ts` — Data fetching hooks
- `apps/web/app/(dashboard)/layout.tsx` — Dashboard layout (make responsive)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Question queue component (Phase 4) — adapt for mobile layout
- Run store + SSE hook — same data layer
- TanStack Query hooks — same API layer
- All transcript components — responsive variants

### Integration Points
- Service worker registration in Next.js
- VAPID keys in server environment
- Push subscription API route
- Hub notification trigger on plan_proposal/question events
- Mobile-specific landing page route

</code_context>

<specifics>
## Specific Ideas

- Mobile wireframe: "Good morning, Henrik" header with warm greeting, gold accent on question cards
- Push notifications are critical for the "agents need you" use case — answering questions from your phone while away from desk

</specifics>

<deferred>
## Deferred Ideas

- Offline mode (view cached runs) — v2
- Custom PWA install banner — v2

</deferred>

---

*Phase: 10-mobile-pwa*
*Context gathered: 2026-04-21*
