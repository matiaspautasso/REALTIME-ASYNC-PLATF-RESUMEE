# Backlog

Implementation tickets grouped by epic, ordered by dependency. Work top to bottom: later epics assume earlier ones are green.

## How to work a ticket

1. Load the skill named in the ticket (`mattpocock-skills:*`) BEFORE writing code.
2. Follow strict TDD: failing test first, then the minimum code to pass, then refactor.
3. A ticket is done only when every acceptance criterion is checkable and checked, and `pnpm lint && pnpm typecheck && pnpm test:unit` is green.
4. Run `code-review` against the ticket's starting point before marking it done.

Each ticket lists: **priority**, **depends on**, **skill**, **description**, **acceptance criteria**, and the **RF** it satisfies.

## Epics

| Epic | Theme | Unlocks |
| --- | --- | --- |
| [EPIC-00](./EPIC-00-foundations.md) | Foundations — monorepo, tooling, Docker, CI skeleton | everything |
| [EPIC-01](./EPIC-01-contracts.md) | Contracts — pure domain logic, DTOs, events | api, worker, web |
| [EPIC-02](./EPIC-02-database.md) | Database — Prisma schema, migrations, client | api, worker |
| [EPIC-03](./EPIC-03-api.md) | API — upload, persistence, outbox, history, retry | realtime, web |
| [EPIC-04](./EPIC-04-worker.md) | Worker — batching, upsert, checkpoints, retries | realtime |
| [EPIC-05](./EPIC-05-realtime.md) | Realtime — QueueEvents → gateway → client | web |
| [EPIC-06](./EPIC-06-frontend.md) | Frontend — dashboard, upload, detail, history | — |
| [EPIC-07](./EPIC-07-resilience-observability.md) | Resilience & observability hardening | testing |
| [EPIC-08](./EPIC-08-testing.md) | Testing — integration, API, resilience scenarios, E2E | CI |
| [EPIC-09](./EPIC-09-ci-docs.md) | CI/CD, Dockerfiles, README, sample data | ship |

## Requirement traceability (MVP)

| RF | Requirement | Ticket(s) |
| --- | --- | --- |
| RF-01 | Upload product CSV | TICKET-03.2 |
| RF-02 | Validate format and required columns | TICKET-03.2, TICKET-01.1 |
| RF-03 | Create and enqueue job | TICKET-03.2, TICKET-03.3 |
| RF-04 | Asynchronous processing via worker | TICKET-04.1, TICKET-04.2, TICKET-04.3 |
| RF-05 | Show status and percentage progress | TICKET-01.1, TICKET-06.4 |
| RF-06 | Update frontend over WebSocket | TICKET-05.2, TICKET-05.3, TICKET-06.4 |
| RF-07 | Automatic retries | TICKET-04.4 |
| RF-08 | Record per-row errors | TICKET-04.3, TICKET-03.5 |
| RF-09 | Consult execution history | TICKET-03.4, TICKET-06.5 |
| RF-10 | Manually retry failed jobs | TICKET-03.6, TICKET-06.5 |
| RF-11 | Process several concurrent jobs | TICKET-04.1, TICKET-07.2 |
| RF-12 | Download error report CSV | TICKET-03.5, TICKET-06.5 |
| RF-13 | Cancel jobs (phase 2) | out of MVP |
| RF-14 | Auth and user management | out of MVP |
