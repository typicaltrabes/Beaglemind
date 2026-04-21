# Phase 9: Operator Console & Sentinel - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build operator tooling: tenant provisioning script (CLI), operator web dashboard (system health, active runs, cost overview), sentinel Phase A passive logging, sentinel pane in Studio (operator-role only), and break-glass flow with customer-visible audit.

</domain>

<decisions>
## Implementation Decisions

### Tenant Provisioning
- **D-01:** CLI script `scripts/provision-tenant.ts` — wraps existing provisionTenantWithAuth() from packages/db. Takes: tenant name, admin email, admin password. Creates: org, schema, MinIO bucket, admin user.
- **D-02:** Runnable via `pnpm --filter @beagle/db run provision-tenant -- --name "Acme" --email admin@acme.com`.

### Operator Dashboard
- **D-03:** New route group: /operator (requires operator role — a flag on the user record or a separate operator org).
- **D-04:** Dashboard page: system health cards (Postgres status, Redis status, MinIO status, Hub status via /health endpoint), active runs count, total cost (last 24h/7d/30d), tenant count.
- **D-05:** Active runs list: tenant name, project name, run status, duration, cost. Click opens run page in read-only mode.

### Sentinel Phase A (Passive Logging)
- **D-06:** Sam already produces sentinel observations via the Hub event stream. Events with type `sentinel_flag` are persisted in the events table. Phase A = read and display these, no new scoring logic.
- **D-07:** Sentinel data visible in Studio's process drawer sentinel section (already built in Phase 6, currently shows empty state). Phase 9 ensures the data flows end-to-end: Sam → Hub → events table → SSE → drawer.
- **D-08:** Operator sentinel view: /operator/sentinel page showing all sentinel flags across tenants (aggregated). Sortable by severity, time.

### Break-Glass Access
- **D-09:** Operator can request break-glass access to a tenant's conversation content. Requires entering a reason. Time-boxed: 4-hour window.
- **D-10:** Break-glass creates an audit record in the tenant's schema: operator_id, reason, granted_at, expires_at. Tenant admin sees this in their audit log.
- **D-11:** During break-glass window, operator can view any run in the tenant as if they were a tenant user. After window expires, access revoked.

### Claude's Discretion
- Operator role implementation (flag vs separate system)
- Health check endpoint integration details
- Break-glass UI flow
- Sentinel flag severity levels

</decisions>

<canonical_refs>
## Canonical References

### Design Document
- Design Doc v3 §10 — Operator access, privacy, break-glass
- Design Doc v3 §11 — Sentinel rollout plan (Phase A = passive logging)

### Existing Code
- `apps/web/components/studio/sentinel-section.tsx` — Sentinel display (Phase 6, shows empty state)
- `apps/web/components/studio/process-drawer.tsx` — Drawer with sentinel section
- `packages/db/src/provision-tenant.ts` — provisionTenantWithAuth()
- `apps/agent-hub/src/events/event-store.ts` — Event persistence (sentinel events flow through here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Sentinel section component (Phase 6) — currently empty, needs real data
- Process drawer (Phase 6) — sentinel pane slot ready
- Provisioning function (Phase 2) — wrap in CLI script
- Event store + SSE (Phase 3/4) — sentinel events already flow through

### Integration Points
- New /operator route group with role check
- Sentinel events: Sam → Hub → events table → SSE → Studio drawer
- CLI provisioning script wrapping existing function
- Break-glass audit table in tenant schema

</code_context>

<specifics>
## Specific Ideas

No specific wireframe for operator console — functional dark-theme dashboard, keep it utilitarian.

</specifics>

<deferred>
## Deferred Ideas

- Sentinel Phase B (rule-based flags) — v2
- Sentinel Phase C (baseline scoring) — v2
- Operator console tenant management UI (list tenants, edit config) — v2

</deferred>

---

*Phase: 09-operator-console-sentinel*
*Context gathered: 2026-04-21*
