# EPIC-03 — API

`apps/api` (NestJS) accepts requests, validates and persists Imports, publishes jobs through the Outbox, and serves history/detail/errors/retry. It never processes CSVs itself.

---

## TICKET-03.1 — Nest bootstrap, config and health

- **Priority**: Obligatory · **Depends on**: 02.3 · **Skill**: `codebase-design`
- **RF**: part of all

Bootstrap the Nest app with typed config, a global validation pipe (class-validator), and `GET /health` checking Postgres and Redis.

**Acceptance criteria**

- [x] App boots reading env via a typed config module.
- [x] `GET /health` returns `200` only when both Postgres and Redis are reachable, `503` otherwise.
- [x] Global `ValidationPipe` with whitelist + transform is enabled.

## TICKET-03.2 — Upload, validate and create Import (+ Outbox)

- **Priority**: Obligatory · **Depends on**: 03.1, 01.2 · **Skill**: `tdd`
- **RF**: RF-01, RF-02, RF-03

`POST /imports` accepts multipart, validates (CSV type, ≤ 5 MB, header has `sku,name,price,stock`, ≤ 10,000 rows), streams the file to `UPLOAD_DIR`, counts `totalRows`, and in ONE transaction persists the `ImportJob` (`QUEUED`) plus an `Outbox` row.

**Acceptance criteria**

- [x] Invalid file (wrong type, too big, missing columns, too many rows) ⇒ `400` and NO Import, NO Outbox row, NO stored file.
- [x] Valid file ⇒ `202` with `{ id, status: "QUEUED", progress: 0, totalRows }`.
- [x] Import row and Outbox row commit atomically (ADR-0004): a forced failure after the Import insert rolls back both.
- [x] The stored file path, not its contents, is what will reach the queue (ADR-0003).

## TICKET-03.3 — Outbox relay → BullMQ producer

- **Priority**: Obligatory · **Depends on**: 03.2 · **Skill**: `tdd`
- **RF**: RF-03

A relay polls unpublished `Outbox` rows and enqueues them to BullMQ (path + import id), marking each `publishedAt` on success.

**Acceptance criteria**

- [x] An unpublished Outbox row is enqueued exactly once on the happy path and marked published.
- [x] If Redis is down, the row stays unpublished and is retried on the next tick (not lost) — mandatory scenario 3.
- [x] Enqueue uses stable BullMQ job ids derived from the import id so a double relay tick cannot create two jobs.

## TICKET-03.4 — History, detail and products

- **Priority**: Obligatory · **Depends on**: 03.1, 01.2 · **Skill**: `tdd`
- **RF**: RF-09

`GET /imports` (paginated history), `GET /imports/:id` (status + metrics), `GET /products` (paginated, SKU filter).

**Acceptance criteria**

- [x] Responses match `Paginated<T>` and the detail shape from `docs/api.md`.
- [x] `GET /imports/:id` on an unknown id ⇒ `404`.
- [x] History is ordered newest first and honours `page`/`pageSize`.

## TICKET-03.5 — Row errors and CSV export

- **Priority**: Obligatory · **Depends on**: 03.4 · **Skill**: `tdd`
- **RF**: RF-08, RF-12

`GET /imports/:id/errors` (paginated) and `GET /imports/:id/errors.csv` (streamed download).

**Acceptance criteria**

- [x] Errors list returns `rowNumber`, `errorCode`, `message`.
- [x] `errors.csv` sets `Content-Type: text/csv` and `Content-Disposition: attachment`.
- [ ] The CSV streams (does not buffer the whole set in memory). *(MVP returns a buffered CSV; error sets are bounded by the 10k-row cap. True streaming deferred.)*

## TICKET-03.6 — Manual retry

- **Priority**: Obligatory · **Depends on**: 03.3 · **Skill**: `tdd`
- **RF**: RF-10

`POST /imports/:id/retry` re-enqueues (through the Outbox) an Import in a terminal `FAILED` state.

**Acceptance criteria**

- [x] Retrying a `FAILED` Import ⇒ `202` and a new Outbox row; status returns to `QUEUED`.
- [x] Retrying a non-terminal or `COMPLETED*` Import ⇒ `409 Conflict`.
- [ ] The resumed run does not duplicate Products or counters (relies on ADR-0005). *(Guaranteed by the worker — verified in EPIC-04/08.)*

## TICKET-03.7 — Swagger / OpenAPI

- **Priority**: Obligatory · **Depends on**: 03.2–03.6 · **Skill**: `codebase-design`

Expose Swagger UI at `/docs` generated from the DTOs and decorators.

**Acceptance criteria**

- [x] `/docs` lists every endpoint with request/response schemas.
- [ ] Response examples match `docs/api.md`. *(Swagger lists every endpoint and schema from the DTOs; curated per-field examples deferred.)*
