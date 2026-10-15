# JobFlow — Distributed Job Processing Platform

A full-stack, backend-focused platform for importing and processing large volumes of data **asynchronously**, with **work queues, independent workers, automatic retries and real-time monitoring**. The concrete use case is **bulk product import from CSV**: a user uploads thousands of products, the system processes them in the background in batches, and the UI streams live progress and results over WebSockets.

Built to demonstrate **production-grade backend engineering** — not just wiring libraries together.

## Engineering highlights

- **Asynchronous job processing** with **BullMQ** on **Redis**, consumed by an **independent NestJS worker** process, separate from the API.
- **Transactional outbox pattern** for reliable, at-least-once job publishing — solving dual-write consistency between **PostgreSQL** and **Redis**.
- **Idempotent, resumable imports**: batch commits with **checkpoints** and **upsert by SKU**, so a crashed or retried worker never duplicates data or counters.
- **Automatic retries with exponential backoff**, distinguishing transient *infrastructure errors* (retried) from *data errors* (recorded per row, never retried).
- **Real-time updates** via **WebSockets (Socket.IO)**: BullMQ `QueueEvents` → NestJS gateway → React, with REST as the single source of truth.
- **Concurrency**: multiple jobs processed in parallel with a configurable worker limit.
- **Testing** across unit (**Jest**), integration (**Testcontainers** with real PostgreSQL + Redis), API (**Supertest**) and end-to-end (**Playwright**) layers.
- **Monorepo** (**pnpm workspaces + Turborepo**), **Docker Compose**, **GitHub Actions CI**, **OpenAPI/Swagger** docs, strict **TypeScript** and **test-driven development**.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, TanStack Query |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Queue / broker | BullMQ, Redis |
| Processing | Independent NestJS worker |
| Real-time | WebSockets, Socket.IO |
| Validation | class-validator, shared domain rules |
| Testing | Jest, Supertest, Playwright, Testcontainers |
| Infra / CI | Docker, Docker Compose, GitHub Actions |

## Monorepo layout

```
apps/
  web/        React + Vite dashboard (TanStack Query, Socket.IO client)
  api/        NestJS REST + WebSocket gateway + transactional outbox relay
  worker/     NestJS BullMQ consumer (batching, upserts, retries, checkpoints)
packages/
  contracts/  DTOs, WebSocket event payloads, pure domain rules (no runtime deps)
  database/   Prisma schema, migrations, generated client
infra/        docker-compose.yml (PostgreSQL + Redis)
docs/         architecture, ADRs, API contract, testing strategy, ticket backlog
samples/      example CSVs (valid, partially invalid, 10k rows)
```

## How to run it locally

Requirements: **Node** (version pinned in `.nvmrc`), **pnpm** and **Docker**.

```bash
# 1. Clone and install (also generates the Prisma client)
pnpm install
cp .env.example .env

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose -f infra/docker-compose.yml up -d

# 3. Apply database migrations and seed demo data
pnpm db:migrate
pnpm --filter @jobflow/database seed

# 4. Run the test suite (pure domain logic, no infra needed)
pnpm test:unit

# 5. Run the apps in watch mode
pnpm dev
```

The full one-command stack (`docker compose up --build` for the API, worker and web as well) is delivered in EPIC-09.

> **Port already in use?** If host port `5432` (PostgreSQL), `6379` (Redis) or `3000` (API) is taken by another local service, override it: e.g. `POSTGRES_PORT=5455 REDIS_PORT=6380 docker compose -f infra/docker-compose.yml up -d`, then point `DATABASE_URL` / `REDIS_PORT` / `API_PORT` at the new ports in your `.env`.

## Common commands

```bash
pnpm test              # all tests
pnpm test:unit         # unit tests only (no Docker)
pnpm test:integration  # Testcontainers — needs Docker
pnpm lint
pnpm typecheck
pnpm build
pnpm db:migrate        # apply Prisma migrations
pnpm db:generate       # regenerate the Prisma client
```

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — domain vocabulary (the canonical terms)
- [`docs/architecture.md`](./docs/architecture.md) — process topology and data flow
- [`docs/adr/`](./docs/adr) — architecture decisions (outbox, checkpoints, REST-as-truth, …)
- [`docs/api.md`](./docs/api.md) — REST + WebSocket contracts
- [`docs/testing.md`](./docs/testing.md) — test strategy and the mandatory resilience scenarios
- [`docs/tickets/`](./docs/tickets) — the implementation backlog, ticket by ticket

## Status

Delivered:

- **Contracts** (EPIC-01) — domain rules, DTOs, WebSocket + queue contracts.
- **Database** (EPIC-02) — Prisma schema, reproducible initial migration, client and seed.
- **API** (EPIC-03) — NestJS REST: health, CSV upload with a transactional outbox, outbox→BullMQ relay, paginated history/detail/products, row errors + CSV export, manual retry, and Swagger at `/docs`. Proven with unit tests and e2e tests that boot the app against real PostgreSQL + Redis.
- **Worker** (EPIC-04) — independent NestJS BullMQ consumer: streams the CSV from the shared volume, processes it in fixed-size batches, upserts products by SKU and records row errors, advances counters and a checkpoint in one transaction per batch, resumes after the last checkpoint, distinguishes data errors (never retried) from infrastructure errors (retried with exponential backoff), and persists the terminal status. Proven with unit tests plus integration and through-Redis e2e tests against real PostgreSQL + Redis.

All green under `pnpm test:unit`, `pnpm typecheck` and `pnpm build`; the API and worker integration suites (`pnpm --filter @jobflow/api test:integration`, `pnpm --filter @jobflow/worker test:integration`) run against Docker. Remaining work (realtime, frontend, resilience hardening, full test suite, CI/CD) is tracked ticket by ticket in [`docs/tickets/`](./docs/tickets).
