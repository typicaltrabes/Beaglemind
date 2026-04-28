---
phase: 17-attachments
plan: 04
status: deployed-pending-uat
deploy_sha: feef8f87862444a0d8a81eb1bb9a33472906a7b7
deploy_completed: 2026-04-28T13:42:15Z
uat_status: pending
---

# Plan 17-04 — Deploy + UAT — Summary

## Objective

Deploy Phase 17 to `console.beaglemind.ai` and close UAT-17-01..03 with Lucas.

## Result: Deployed, awaiting UAT

The deploy execution path (pre-flight → push → migration → rebuild → smoke) completed end-to-end on prod. The executor agent crashed (Anthropic API `overloaded_error` after 77 tool uses) before writing this SUMMARY and before the human-verify checkpoint formally returned. The orchestrator (this main session) verified prod state post-crash and confirmed all dangerous operations completed cleanly.

## Verified deploy state (orchestrator post-crash audit)

| Check | Command | Result |
|-------|---------|--------|
| Local main pushed | `git rev-list --count origin/main..main` | `0` (in sync) |
| Prod build dir HEAD | `sudo git -C /tmp/beagle-build rev-parse HEAD` | `feef8f87862444a0d8a81eb1bb9a33472906a7b7` ✓ |
| `extracted_text` column | `SELECT column_name FROM information_schema.columns WHERE table_schema='tenant_eb61fa6a_1392_49c2_8209_ae8fa3612779' AND table_name='artifacts' AND column_name='extracted_text'` | `extracted_text` ✓ (1 tenant, Hanseatic) |
| console-web container | `sudo docker ps --filter name=console-web` | `beagle-console-console-web-1 \| Up 12 minutes` (created 13:42:15 UTC) ✓ |
| Container logs healthy | `sudo docker logs --tail 20 beagle-console-console-web-1` | Next.js 15.5.15, ready in 102ms, no errors ✓ |
| /api/health | `curl -fsS https://console.beaglemind.ai/api/health` | `307` (redirect to /login — expected, auth-gated) ✓ |
| /login | `curl -fsS https://console.beaglemind.ai/login` | `200` ✓ |
| / | `curl -fsS https://console.beaglemind.ai/` | `307` ✓ |

**[BLOCKING] migration-before-rebuild ordering:** honored. The `extracted_text` column is present in the live DB, and the rebuilt container is the one consuming it. Verified by: column-exists query returned `extracted_text` AND container creation timestamp (13:42:15 UTC) is after the migration script run.

**Non-Phase-17 services preserved:** `console-agent-hub` and `console-worker` were NOT recreated (Phase 17's V1 simplification kept hub schemas stable; only `apps/web` changed).

## Outstanding work

**UAT (human-verify checkpoint):** The 3-scenario UAT script lives in 17-04-PLAN.md `<how-to-verify>` (Task 4). Lucas runs it manually in the browser. After Lucas types "approved":
1. Mark `UAT-17-01`, `UAT-17-02`, `UAT-17-03` as `[x] Complete` in `.planning/REQUIREMENTS.md`
2. Update REQUIREMENTS.md traceability table rows for UAT-17-01..03 from `Pending` → `Complete`
3. Update STATE.md and ROADMAP.md to mark Phase 17 closed (4/4 plans, current phase advances)

**SUMMARY for orchestrator-completed work (this file):** committed as part of post-crash recovery, not by the executor.

## Known limitations (V1 boundary, not failures)

- Image base64 pass-through to vision-capable agents is NOT in this phase. Agents see a textual `(image — included with this message)` placeholder. Documented in CONTEXT.md.
- Image OCR / handwriting recognition: out of scope.
- File-deletion UI: out of scope. X-removed-before-send leaves dangling MinIO objects (acceptable for V1).
- LiteLLM is currently down at Henrik's end (unrelated to Phase 17). Phase 17 features do not depend on LiteLLM.

## Crash forensics (for the record)

- Executor model: Opus 4.7
- Crash cause: Anthropic API `overloaded_error` after 77 tool uses, ~22 min into execution
- Crash point: AFTER push + migration + rebuild + smoke checks completed (verified via prod state); BEFORE 17-04-SUMMARY.md commit and BEFORE human-checkpoint return
- Recovery: orchestrator (main session) audited prod state, confirmed all dangerous ops succeeded, wrote this SUMMARY, will mark UAT items after Lucas's manual verify

## Commits

This SUMMARY commit will be the only 17-04 commit. The executor made no commits during its run (it had not yet reached `git_commit_metadata` step when the API overload occurred).

---

**Goal-backward check:** Does the deployed system let Lucas attach files to a prompt and have agents respond about them?

- ✅ Composer paperclip + drag-drop wired (Plan 17-01)
- ✅ POST endpoint + MinIO + extraction live (Plan 17-02)
- ✅ Messages route prepends `--- USER ATTACHMENTS ---` block (Plan 17-03)
- ✅ Schema migration applied to live DB
- ✅ Container running new code, smoke checks green
- ⏳ End-to-end "Lucas attaches a PDF, agent quotes it" — pending Lucas's manual UAT
