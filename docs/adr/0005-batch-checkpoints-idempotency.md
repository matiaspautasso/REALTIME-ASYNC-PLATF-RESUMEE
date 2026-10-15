# Batch commits with checkpoints for idempotent, resumable imports

The worker processes Rows in Batches of a fixed size (default 100). Each Batch is upserted and committed in one PostgreSQL transaction, and that same transaction advances the Import's Checkpoint (the count of committed Batches) and its counters.

Because enqueuing is at-least-once (ADR-0004) and a worker can crash mid-import, the same Import may run more than once. Two mechanisms keep this safe:

- **Upsert by SKU** makes re-processing a Row naturally idempotent — a second upsert of the same SKU updates in place instead of duplicating.
- **Checkpoint resume** makes counters idempotent — a retry skips Batches already committed, so `processedRows` / `successRows` / `failedRows` are never double-counted.

## Considered Options

- **Row-by-row commits**: simplest idempotency but one transaction per Row — far too slow for 10,000 Rows.
- **Single transaction for the whole file**: fast to reason about but a crash loses all progress and a 10k-row transaction is a long lock.

Batching balances throughput against recoverable progress, and the checkpoint is what makes a resumed Attempt correct rather than merely not-crashing.
