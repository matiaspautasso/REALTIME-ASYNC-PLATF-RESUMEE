# Architecture

JobFlow imports large CSV product files asynchronously. The API accepts a file and returns immediately; an independent worker processes it in batches and reports progress; the browser watches progress live over WebSocket and reconciles against REST.

Read [`../CONTEXT.md`](../CONTEXT.md) for the vocabulary (Import, Batch, Checkpoint, Outbox, Data vs Infrastructure Error). The decisions behind this shape are in [`adr/`](./adr).

## Process topology

```
                 ┌──────────────┐        ┌──────────────┐
 browser ──REST──▶   apps/api    │        │  apps/worker  │
         ◀─WS─────┤  NestJS      │        │  NestJS       │
                 │  REST + WS   │        │  BullMQ       │
                 │  gateway     │        │  consumer     │
                 │  outbox relay│        └──────┬────────┘
                 └──────┬───────┘               │
                        │  enqueue (path + id)  │ upsert, counters,
                        ▼                       ▼ attempts, checkpoints
                 ┌──────────────┐        ┌──────────────┐
                 │    Redis     │◀──────▶│  PostgreSQL  │
                 │  BullMQ +    │ events │  source of   │
                 │  QueueEvents │        │  truth       │
                 └──────────────┘        └──────────────┘
                        ▲
        shared volume (CSV files) mounted by api + worker
```

Three runnable apps, two shared packages:

- `apps/api` — REST endpoints, file upload, Import persistence, the Outbox relay, and the WebSocket gateway.
- `apps/worker` — BullMQ consumer; reads the CSV from the shared volume and processes it in Batches.
- `apps/web` — React + Vite dashboard; TanStack Query over REST, Socket.IO for live deltas.
- `packages/contracts` — DTOs, WebSocket event payloads, the `ImportStatus` state machine, and pure domain rules (row validation, progress). No runtime dependencies; consumed by all three apps.
- `packages/database` — Prisma schema, generated client and migrations; consumed by api and worker.

## Import flow (happy path)

1. Browser `POST /imports` with the CSV (multipart).
2. API validates the file (size ≤ 5 MB, required columns `sku,name,price,stock`), streams it to `UPLOAD_DIR`, and in ONE transaction writes the `ImportJob` (`QUEUED`) plus an `Outbox` row. Responds `202 Accepted` with `{ id, status, progress, totalRows }`.
3. The Outbox relay publishes the pending entry to BullMQ (file path + import id) and marks it published.
4. A worker picks up the job, opens a `JobAttempt`, moves the Import to `PROCESSING`.
5. The worker streams the CSV, accumulating Rows into Batches of `IMPORT_BATCH_SIZE`. For each Batch, in one transaction: upsert valid Rows by SKU, insert `ImportError` rows for invalid ones, advance counters and the Checkpoint.
6. After each Batch the worker emits progress; `QueueEvents` relays it to the API gateway, which pushes `import:progress` to subscribed clients.
7. On the last Batch the worker persists the terminal status (`COMPLETED` / `COMPLETED_WITH_ERRORS`) and only then emits `import:completed`.

## Resilience flow

- **Dual-write safety** — enqueue intent and Import row commit together via the Outbox (ADR-0004); a Redis outage can delay but not lose an Import.
- **Retries** — Infrastructure Errors bubble out of the processor; BullMQ retries up to `IMPORT_MAX_ATTEMPTS` with exponential backoff, emitting `import:retrying`. Data Errors are caught, recorded as `ImportError`, and never retried.
- **Idempotent resume** — a re-run resumes after the last Checkpoint and upserts by SKU, so counters and Products are never duplicated (ADR-0005).
- **Reconnect correctness** — REST is the source of truth; the browser re-fetches on reconnect and treats WebSocket as live deltas only (ADR-0006).
- **Observability** — structured logs keyed by `importId`, `jobId`, `attemptNumber` and batch duration.

## Where to change what

| Change | Lives in |
| --- | --- |
| A business rule for a Row (price, stock, SKU) | `packages/contracts` (pure validation) |
| The data model | `packages/database` (Prisma schema + migration) |
| A REST endpoint or the WS gateway | `apps/api` |
| How Batches are processed / retried / resumed | `apps/worker` |
| A screen or live-update behaviour | `apps/web` |
