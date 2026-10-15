# EPIC-09 — CI/CD, Docker & docs

Make the project ship from a clean clone with `docker compose up --build` and prove it in CI. Continuous Integration only — no cloud deploy (by decision; the stack runs locally).

---

## TICKET-09.1 — Full CI pipeline

- **Priority**: Obligatory · **Depends on**: 00.4, 08.x · **Skill**: `codebase-design`

Extend the CI skeleton into the full pipeline: lint → typecheck → unit → integration → docker build → E2E → coverage.

**Acceptance criteria**

- [ ] Stages run in order and the job fails if any fails.
- [ ] Integration and E2E stages have Docker available.
- [ ] A coverage report is produced and surfaced on the run.

## TICKET-09.2 — Dockerfiles

- **Priority**: Obligatory · **Depends on**: 03.x, 04.x, 06.x · **Skill**: `codebase-design`

Multi-stage Dockerfiles for api, worker and web, wired into `infra/docker-compose.yml`.

**Acceptance criteria**

- [ ] Each image builds from the monorepo with pnpm and only its needed workspace.
- [ ] `docker compose up --build` starts the whole stack from a clean clone.
- [ ] api and worker share the upload volume (ADR-0003).

## TICKET-09.3 — README and demo

- **Priority**: Obligatory · **Depends on**: 09.2 · **Skill**: `writing-for-agents`

A README covering architecture, the one-command run, and a short demo (GIF or steps) of an import.

**Acceptance criteria**

- [ ] `docker compose up --build` from a clean clone is documented and works.
- [ ] Links to `docs/architecture.md`, `docs/api.md`, `docs/adr/`.
- [ ] Shows the happy-path import visually.

## TICKET-09.4 — Sample data and fixtures

- **Priority**: Obligatory · **Depends on**: 02.2 · **Skill**: `tdd`
- **RF**: RF-01, RF-12

Ship sample CSVs (valid, partially invalid, ~10k rows) and a sample error report for demos and tests.

**Acceptance criteria**

- [ ] Sample files live under a known fixtures path and are referenced by the README.
- [ ] The partially-invalid sample reliably produces `COMPLETED_WITH_ERRORS`.
