# Phase 1: Foundation & Infrastructure - Validation

**Generated:** 2026-04-21
**Source:** 01-RESEARCH.md Validation Architecture section

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` at repo root |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

## Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | Docker Compose starts 3 containers + MinIO | smoke | `docker compose -f docker/docker-compose.yml config` (validates syntax) | No -- created in Plan 01-02 |
| INFR-02 | Caddy routes to console-web container | smoke | Manual -- requires deployed env + DNS propagation | N/A manual-only |
| INFR-03 | Memory limits set on containers | unit | `pnpm vitest run tests/docker-compose-config.test.ts` (parse and assert limits in YAML) | No -- created in Plan 01-02 |
| INFR-04 | CI/CD workflow syntax valid | unit | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML_VALID')"` | No -- created in Plan 01-03 |
| INFR-05 | Monorepo packages resolve cross-deps | smoke | `pnpm install && pnpm -r build` | No -- created in Plan 01-01 T1 |
| INFR-06 | Vault resolver returns path for tenant | unit | `pnpm vitest run packages/db/src/__tests__/vault-resolver.test.ts` | No -- created in Plan 01-01 T2 |

## Sampling Rate

- **Per task commit:** `pnpm vitest run` (quick, unit tests only)
- **Per wave merge:** `pnpm -r build && pnpm vitest run` (build + test)
- **Phase gate:** Full build + `docker compose config` validation + vault resolver tests + MinIO client compiles

## Wave 0 Gaps (addressed by plans)

- [x] `vitest.config.ts` at root -- Plan 01-01 Task 1 creates this
- [x] `packages/db/src/__tests__/vault-resolver.test.ts` -- Plan 01-01 Task 2 creates this
- [x] Vitest install: `pnpm add -Dw vitest` -- Plan 01-01 Task 1 includes in devDependencies

## Coverage Notes

- INFR-01 and INFR-03 are validated by `docker compose config` in Plan 01-02. Full container startup verified via SSH checkpoint.
- INFR-02 is inherently manual (requires DNS + TLS + browser verification). Covered by Plan 01-02 Task 2 checkpoint.
- INFR-04 is validated by YAML parse check in Plan 01-03 Task 1. Full pipeline verification is Plan 01-03 Task 2 checkpoint.
- INFR-05 and INFR-06 are fully automated in Plan 01-01.
