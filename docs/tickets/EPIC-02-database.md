# EPIC-02 — Database

`packages/database` owns the Prisma schema, migrations and the generated client. It is the only package that talks to PostgreSQL directly; api and worker import its client.

---

## TICKET-02.1 — Prisma schema and enums

- **Priority**: Obligatory · **Depends on**: 00.1 · **Skill**: `domain-modeling`
- **RF**: RF-04, RF-08

Model `Product`, `ImportJob`, `ImportError`, `JobAttempt` and `Outbox` per the data model, with the `ImportStatus` enum mirroring `packages/contracts`.

**Acceptance criteria**

- [x] `Product.sku` is unique (enables upsert by SKU).
- [x] `ImportJob` carries `fileName`, `filePath`, `status`, `totalRows`, `processedRows`, `successRows`, `failedRows`, `progress`, `committedBatches` (the Checkpoint), timestamps.
- [x] `ImportError` has `importJobId`, `rowNumber`, `errorCode`, `message`; indexed by `importJobId`.
- [x] `JobAttempt` has `importJobId`, `attemptNumber`, `startedAt`, `finishedAt`, `errorMessage`, `status`.
- [x] `Outbox` has `id`, `importJobId`, `payload`, `publishedAt` (nullable), `createdAt`.
- [x] Field names match the `CONTEXT.md` vocabulary.

## TICKET-02.2 — Initial migration, seed and sample CSVs

- **Priority**: Obligatory · **Depends on**: 02.1 · **Skill**: `tdd`
- **RF**: RF-01

A reproducible first migration, a seed script, and sample CSV fixtures used by dev and tests.

**Acceptance criteria**

- [x] `pnpm db:migrate` on a clean Postgres creates every table.
- [x] Sample CSVs exist: a fully valid file, a partially invalid file, and a ~10k-row file.
- [x] Re-running the seed is idempotent.

## TICKET-02.3 — Database client package

- **Priority**: Obligatory · **Depends on**: 02.1 · **Skill**: `codebase-design`
- **RF**: RF-04

Export a single configured `PrismaClient` plus repository helpers used by api and worker, so neither app news-up Prisma itself.

**Acceptance criteria**

- [x] One exported client instance; `DATABASE_URL` read from env.
- [x] A transaction helper the worker uses for per-Batch commits.
- [x] Builds with type declarations; consumed via `@jobflow/database`.
