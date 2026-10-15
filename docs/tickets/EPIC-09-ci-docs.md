# EPIC-09 — CI/CD, Docker & docs

Make the project ship from a clean clone with `docker compose up --build` and prove it in CI. Continuous Integration only — no cloud deploy (by decision; the stack runs locally).

---

## TICKET-09.1 — Full CI pipeline

- **Priority**: Obligatory · **Depends on**: 00.4, 08.x · **Skill**: `codebase-design`

Extend the CI skeleton into the full pipeline: lint → typecheck → unit → integration → docker build → E2E → coverage.

**Acceptance criteria**

- [x] Stages run in order and the job fails if any fails. *(Jobs chained with `needs:` — verify → integration → docker-build → e2e.)*
- [x] Integration and E2E stages have Docker available. *(`ubuntu-latest` provides Docker; integration uses Testcontainers, E2E uses Docker Compose.)*
- [x] A coverage report is produced and surfaced on the run. *(Jest `--coverage` on the integration job, uploaded as an artifact.)*

## TICKET-09.2 — Dockerfiles

- **Priority**: Obligatory · **Depends on**: 03.x, 04.x, 06.x · **Skill**: `codebase-design`

Multi-stage Dockerfiles for api, worker and web, wired into `infra/docker-compose.yml`.

**Acceptance criteria**

- [x] Each image builds from the monorepo with pnpm and only its needed workspace. *(`pnpm --filter @jobflow/<app>... build`; verified with `docker compose build`.)*
- [x] `docker compose up --build` starts the whole stack from a clean clone. *(Smoke-tested: health 200, an uploaded CSV processed to COMPLETED_WITH_ERRORS in-container.)*
- [x] api and worker share the upload volume (ADR-0003). *(Both mount `uploads:/data/uploads`; the worker read the API-written CSV in the smoke test.)*

## TICKET-09.3 — README and demo

- **Priority**: Obligatory · **Depends on**: 09.2 · **Skill**: `writing-for-agents`

A README covering architecture, the one-command run, and a short demo (GIF or steps) of an import.

**Acceptance criteria**

- [x] `docker compose up --build` from a clean clone is documented and works.
- [x] Links to `docs/architecture.md`, `docs/api.md`, `docs/adr/`.
- [x] Shows the happy-path import visually. *(README "Demo" walks the upload → live progress → terminal state flow; steps rather than a GIF.)*

## TICKET-09.4 — Sample data and fixtures

- **Priority**: Obligatory · **Depends on**: 02.2 · **Skill**: `tdd`
- **RF**: RF-01, RF-12

Ship sample CSVs (valid, partially invalid, ~10k rows) and a sample error report for demos and tests.

**Acceptance criteria**

- [x] Sample files live under a known fixtures path and are referenced by the README.
- [x] The partially-invalid sample reliably produces `COMPLETED_WITH_ERRORS`.
