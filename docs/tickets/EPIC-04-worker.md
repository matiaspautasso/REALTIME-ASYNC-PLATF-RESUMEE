# EPIC-04 — Worker

`apps/worker` (standalone NestJS) consumes the queue and does the heavy processing: streaming the CSV, batching, upserting, recording errors, and advancing checkpoints. This epic is where the resilience requirements become real.

---

## TICKET-04.1 — Worker bootstrap, consumer and JobAttempt lifecycle

- **Priority**: Obligatory · **Depends on**: 02.3, 03.3 · **Skill**: `codebase-design`
- **RF**: RF-04, RF-11

A standalone Nest app with a BullMQ consumer bound to the imports queue, honouring `WORKER_CONCURRENCY`. On each job it opens a `JobAttempt` and moves the Import to `PROCESSING`.

**Acceptance criteria**

- [x] Worker runs as its own process/image (ADR-0002), not inside the API. *(Standalone `apps/worker` process booted via `NestFactory.createApplicationContext`; the Docker image is wired in EPIC-09.)*
- [x] Concurrency is configurable; two jobs can process in parallel (RF-11). *(`WORKER_CONCURRENCY` → BullMQ `Worker` concurrency; e2e enqueues two jobs and both reach COMPLETED.)*
- [x] Every job execution creates a `JobAttempt` with an incrementing `attemptNumber`. *(attemptNumber is DB-driven so it stays monotonic across manual retries.)*

## TICKET-04.2 — CSV streaming and batching

- **Priority**: Obligatory · **Depends on**: 04.1, 01.1 · **Skill**: `tdd`
- **RF**: RF-04

Read the CSV from the shared volume by path and accumulate Rows into Batches of `IMPORT_BATCH_SIZE` without loading the whole file into memory.

**Acceptance criteria**

- [x] File is read as a stream; a 10k-row file processes without buffering all rows. *(`readline` over `createReadStream`, one Batch of memory at a time; `samples/products-10k.csv` for manual proof.)*
- [x] Rows are grouped into fixed-size Batches; the final partial Batch is handled. *(Unit test asserts batches `[2,2,1]` with correct first row numbers.)*
- [x] Each Row is validated via `validateProductRow` from `packages/contracts` (no duplicated rules).

## TICKET-04.3 — Batch transaction: upsert, errors, counters, checkpoint

- **Priority**: Obligatory · **Depends on**: 04.2 · **Skill**: `tdd`
- **RF**: RF-04, RF-08

For each Batch, in ONE PostgreSQL transaction: upsert valid Rows by SKU, insert `ImportError` rows for invalid ones, increment `processedRows`/`successRows`/`failedRows`, and advance `committedBatches` (the Checkpoint).

**Acceptance criteria**

- [x] Valid and invalid Rows in the same Batch: valid ones persist, invalid ones become `ImportError`, none blocks another — mandatory scenario 2.
- [x] Counters and Checkpoint advance in the same transaction as the upserts (no partial counting on crash). *(All writes in one `runInTransaction`; a per-batch guard on `committedBatches` makes re-commit a no-op.)*
- [x] Upsert by SKU updates an existing Product instead of duplicating — mandatory scenario 7.

## TICKET-04.4 — Retry policy: data vs infra, backoff, resume

- **Priority**: Obligatory · **Depends on**: 04.3 · **Skill**: `tdd`
- **RF**: RF-07

Distinguish Data Errors (recorded, never retried) from Infrastructure Errors (fail the Attempt, retry with exponential backoff up to `IMPORT_MAX_ATTEMPTS`). On a retry, resume AFTER the last Checkpoint.

**Acceptance criteria**

- [x] A Data Error never triggers a BullMQ retry — mandatory scenario 5. *(Data Errors are values from `validateProductRow`, never thrown; `process` resolves and reaches a terminal status.)*
- [x] A transient Infrastructure Error retries with exponential backoff and can then succeed — mandatory scenario 5. *(Integration: a missing file throws then a fixed re-run succeeds; e2e: BullMQ retries with exponential backoff.)*
- [x] A worker killed mid-import resumes from the Checkpoint with no duplicated Products or counters — mandatory scenarios 4 and 8. *(Resume skips Batches below `committedBatches`; counters stay correct, upsert-by-SKU keeps Products unique.)*
- [x] Retries are capped at `IMPORT_MAX_ATTEMPTS`; exhaustion ⇒ `FAILED`. *(e2e with `attempts: 2` records two FAILED JobAttempts and sets the Import `FAILED`.)*

## TICKET-04.5 — Terminal state resolution and progress emission

- **Priority**: Obligatory · **Depends on**: 04.3 · **Skill**: `tdd`
- **RF**: RF-05

After each Batch emit progress; on the last Batch resolve and PERSIST the terminal status (`COMPLETED` if `failedRows === 0`, else `COMPLETED_WITH_ERRORS`) before any completion event.

**Acceptance criteria**

- [x] Progress percent uses `calculateProgress` from `packages/contracts`. *(Persisted per Batch inside the commit transaction.)*
- [x] Terminal status persisted before the completion signal is emitted (ADR-0006). *(`finish` persists the terminal status; the WebSocket completion event itself is wired in EPIC-05.)*
- [x] `COMPLETED_WITH_ERRORS` iff at least one `ImportError`, else `COMPLETED`. *(`resolveTerminalStatus(failedRows)`, unit-tested.)*
