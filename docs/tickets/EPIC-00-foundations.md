# EPIC-00 — Foundations

Make a clean clone runnable and testable. No feature logic yet — just the skeleton every other epic stands on.

---

## TICKET-00.1 — Monorepo scaffold

- **Priority**: Obligatory · **Depends on**: — · **Skill**: `codebase-design`

Set up pnpm workspaces + Turborepo with a shared TypeScript base config and the `apps/*` + `packages/*` layout.

**Acceptance criteria**

- [x] `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, `tsconfig.base.json` exist.
- [x] `apps/` holds `web`, `api`, `worker`; `packages/` holds `contracts`, `database` (stubs allowed).
- [ ] `pnpm install` from a clean clone succeeds.
- [ ] `pnpm typecheck` runs across the workspace (even if trivially green).

## TICKET-00.2 — Shared lint, format and test tooling

- **Priority**: Obligatory · **Depends on**: 00.1 · **Skill**: `codebase-design`

One ESLint + Prettier config shared by all packages, and a reusable Jest preset for TypeScript.

**Acceptance criteria**

- [ ] `pnpm lint` and `pnpm typecheck` pass on an empty workspace.
- [ ] A shared `ts-jest` preset is consumed by at least `packages/contracts`.
- [ ] Each package exposes `lint`, `typecheck`, `test` scripts that Turborepo orchestrates.

## TICKET-00.3 — Docker Compose for the full stack

- **Priority**: Obligatory · **Depends on**: 00.1 · **Skill**: `wizard` (dashboard walkthrough if credentials are ever needed; otherwise plain)

`infra/docker-compose.yml` with PostgreSQL, Redis, api, worker and web, plus the shared upload volume and `.env.example`.

**Acceptance criteria**

- [ ] `docker compose -f infra/docker-compose.yml up` starts Postgres and Redis with healthchecks.
- [ ] api and worker mount the SAME upload volume (ADR-0003).
- [ ] `.env.example` documents every variable; the compose file reads from it.
- [ ] Services wait for Postgres/Redis healthchecks before starting.

## TICKET-00.4 — CI skeleton

- **Priority**: Obligatory · **Depends on**: 00.2 · **Skill**: `codebase-design`

`.github/workflows/ci.yml` running install → lint → typecheck → unit tests on push/PR. Later epics extend it (EPIC-09).

**Acceptance criteria**

- [ ] Workflow triggers on push and pull_request.
- [ ] Uses pnpm with a frozen lockfile and Node from `.nvmrc`.
- [ ] Caches the pnpm store and `.turbo`.
- [ ] Fails the build if lint, typecheck or unit tests fail.
