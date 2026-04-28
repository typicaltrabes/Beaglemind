# Phase 17 — Deferred Items

Discoveries during execution that are out-of-scope for the active plan and
should be addressed elsewhere.

## Pre-existing typecheck errors in `apps/agent-hub`

**Found during:** 17-01 monorepo-wide `pnpm -r exec tsc --noEmit` smoke pass
**Scope:** Not introduced by Phase 17 — these errors exist on a clean
`apps/agent-hub` working tree before any 17-01 edits.

Errors observed (`apps/agent-hub`):
```
src/connections/openclaw-cli-bridge.ts(73,39): error TS2353
  'costUsd' does not exist on type '{ text: string; runId: string; durationMs: number; }'
src/http/routes.ts(201,70): error TS2339
  Property 'costUsd' does not exist on type '{ text: string; runId: string; durationMs: number; }'
src/http/routes.ts(201,93): error TS2339
  Property 'model' does not exist on type '{ text: string; runId: string; durationMs: number; }'
```

These look like a drift between the OpenClaw CLI bridge response shape and
the consumer in `routes.ts`. The shared event schema (`packages/shared`)
likely needs `costUsd` and `model` fields added, OR the consumer should stop
referencing them.

**Disposition:** Plan 17-03 (round-table delivery) modifies
`apps/agent-hub/src/http/routes.ts` and is the natural place to address this
— bundle the fix there, or schedule a small follow-up plan.

The Phase 17-01 plan's stated verification scope is
`cd apps/web && pnpm exec tsc --noEmit` (apps/web only), which passes clean.
