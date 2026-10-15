# EPIC-07 — Resilience & observability hardening

The resilience mechanisms are built into EPIC-03/04; this epic hardens their edges and adds the observability that proves they work.

---

## TICKET-07.1 — Structured logging

- **Priority**: Obligatory · **Depends on**: 04.1 · **Skill**: `codebase-design`

Structured (JSON) logs across api and worker, keyed by `importId`, `jobId`, `attemptNumber`, with batch duration on each committed Batch.

**Acceptance criteria**

- [x] Every log line in a job's lifecycle can be filtered by `importId`.
- [x] Batch logs include row count and duration.
- [x] Retries log the attempt number and the Infrastructure Error cause.

## TICKET-07.2 — Concurrency configuration

- **Priority**: Obligatory · **Depends on**: 04.1 · **Skill**: `tdd`
- **RF**: RF-11

`WORKER_CONCURRENCY` (default 2) with a documented upper bound, verified under concurrent load.

**Acceptance criteria**

- [x] Two imports process concurrently without corrupting each other's counters — mandatory scenario 7.
- [x] Concurrency is read from env and documented in `.env.example`.

## TICKET-07.3 — Outbox / enqueue failure recovery

- **Priority**: Obligatory · **Depends on**: 03.3 · **Skill**: `diagnosing-bugs`

Explicitly handle the "Postgres committed, Redis publish failed" window and surface stuck Imports.

**Acceptance criteria**

- [x] An Import whose Outbox row never published is detectable (unpublished + age) and re-published on recovery — mandatory scenario 3.
- [x] No Import can sit in `QUEUED` forever once Redis is back.
