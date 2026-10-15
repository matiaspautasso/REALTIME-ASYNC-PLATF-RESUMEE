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

## Run the whole stack with one command

Requirements: **Docker**. From a clean clone:

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

This builds the api, worker and web images, waits for PostgreSQL and Redis, runs
the migrations, and starts everything. Then open:

- **Web dashboard** → http://localhost:5173
- **API + Swagger** → http://localhost:3000/docs
- **Health** → http://localhost:3000/health

### Demo: a CSV import end to end

1. Open the dashboard and go to **New import**.
2. Upload `samples/products-with-errors.csv` (2 valid rows, 4 invalid).
3. You are routed to the import detail view; the **progress bar advances live**
   over the WebSocket as the worker commits batches.
4. It finishes **COMPLETED_WITH_ERRORS** (progress 100%, 2 succeeded, 4 failed);
   the row errors are listed and downloadable as `errors.csv`, and the attempt
   history is shown. `samples/products-valid.csv` finishes **COMPLETED**, and
   `samples/products-10k.csv` demonstrates streaming/batching at scale.

> **Port already in use?** If host `5432` (PostgreSQL), `6379` (Redis), `3000`
> (API) or `5173` (web) is taken, override the published ports, e.g.
> `POSTGRES_PORT=5456 REDIS_PORT=6381 API_PORT=3100 WEB_PORT=5174 docker compose -f infra/docker-compose.yml up --build`
> (rebuild so the web picks up the new `API_PORT` for its browser calls).

## Develop against the apps (watch mode)

Requirements: **Node** (version pinned in `.nvmrc`), **pnpm** and **Docker**.

```bash
# 1. Install (also generates the Prisma client)
pnpm install
cp .env.example .env

# 2. Start infrastructure (PostgreSQL + Redis)
docker compose -f infra/docker-compose.yml up -d postgres redis

# 3. Apply database migrations and seed demo data
pnpm db:migrate
pnpm --filter @jobflow/database seed

# 4. Run the unit suite (pure domain logic, no infra needed)
pnpm test:unit

# 5. Run api + worker + web in watch mode
pnpm dev
```

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
- **Realtime** (EPIC-05) — progress flows worker → Redis (BullMQ `QueueEvents`) → API Socket.IO gateway → browser room, keyed by `importId`. The worker never holds a socket; terminal events fire only after the status is persisted (REST stays the source of truth). Proven with a gateway room-isolation e2e and a full worker→Redis→gateway e2e.
- **Frontend** (EPIC-06) — a React + Vite + TypeScript dashboard: live counters and progress bars, CSV upload with a client-side guard, a live import detail view (progress, counters, row errors, attempt history) that updates over the socket, and a paginated/filterable history with retry and errors.csv download. TanStack Query owns REST state; the socket patches/invalidates the cache and re-fetches on reconnect (REST is the source of truth).
- **Resilience & observability** (EPIC-07) — structured JSON logs keyed by `importId`/`attemptNumber` with per-batch durations; configurable worker concurrency; and outbox backlog detection that re-publishes once Redis recovers.
- **Testing** (EPIC-08) — unit (Jest/Vitest), integration against real PostgreSQL + Redis booted on demand with **Testcontainers**, API tests with Supertest, an auditable suite covering the eight mandatory resilience scenarios, and a Playwright browser E2E.
- **CI/CD, Docker & docs** (EPIC-09) — multi-stage Dockerfiles for api/worker/web, a one-command Docker Compose stack, and a GitHub Actions pipeline (lint → typecheck → unit → integration → docker build → E2E).

All green under `pnpm test:unit`, `pnpm typecheck` and `pnpm build`; the integration suites (`pnpm --filter @jobflow/api test:integration`, `pnpm --filter @jobflow/worker test:integration`) boot real PostgreSQL + Redis via Testcontainers (Docker required).
