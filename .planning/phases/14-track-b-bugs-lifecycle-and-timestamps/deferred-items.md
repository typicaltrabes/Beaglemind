# Phase 14 Deferred Items

Out-of-scope discoveries logged during plan execution. Not fixed inline because they
predate the current task and fall outside the plan's stated file boundaries.

---

## From 14-02 execution (2026-04-27)

### Pre-existing TS errors in `apps/agent-hub` baseline tsc

Confirmed present on HEAD before any 14-02 edits via `git stash` + `tsc --noEmit`. Both
errors are in code the plan explicitly forbids modifying ("DO NOT touch the per-agent
loop body"). They are unrelated to the runRoundTable terminal completion fix.

1. `apps/agent-hub/src/connections/openclaw-cli-bridge.ts:73`
   - `error TS2353: Object literal may only specify known properties, and 'costUsd' does not exist in type '{ text: string; runId: string; durationMs: number; }'`
   - The function returns `{ text, runId, durationMs, costUsd, model }` but the inferred
     return type omits `costUsd` and `model`. Likely needs an explicit return type
     annotation on `sendToAgent` exposing those fields.

2. `apps/agent-hub/src/http/routes.ts:201` (the `metadata: { ..., costUsd: result.costUsd, model: result.model }` line inside the per-agent loop)
   - `error TS2339: Property 'costUsd' does not exist on type ...`
   - `error TS2339: Property 'model' does not exist on type ...`
   - Will resolve automatically once item (1) is fixed (downstream consumer of the
     wrong return type).

**Suggested fix:** Add an explicit return type to `sendToAgent` in
`openclaw-cli-bridge.ts` so `costUsd` and `model` flow through to callers. Out of
scope for 14-02 (Bug 2: lifecycle terminal-status fix only).

### Pre-existing vitest failure in `apps/agent-hub`

`src/__tests__/message-router.test.ts` fails to load because `src/config.ts` does a
top-level `EnvSchema.parse(process.env)` requiring `DATABASE_URL` and `REDIS_URL`.
Pulling in `logger.ts` (and any module that depends on it) eagerly evaluates that
parse, so any test importing `notifications/push-service.ts` (and transitively the
logger) crashes at import time.

Confirmed pre-existing on HEAD baseline (same failure with my 14-02 changes stashed).
9/9 tests in the loadable suites still pass. No regression introduced by 14-02.

**Suggested fix:** Lazy-load config in logger.ts, or set test fixtures (.env.test) so
the env schema parse succeeds in vitest. Out of scope for 14-02.
