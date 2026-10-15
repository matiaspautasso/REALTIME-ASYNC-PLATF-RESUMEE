# JobFlow

Distributed job-processing platform for asynchronous, bulk CSV product imports. This glossary is the canonical vocabulary for the domain. Code, DTOs, events and docs use these exact terms.

## Language

**Product**:
A sellable item identified by its SKU, with a name, price and stock level. The catalog is the set of all Products.
_Avoid_: Item, article, SKU (the SKU identifies a Product, it is not the Product).

**SKU**:
The unique business identifier of a Product. Stable across Imports: the same SKU always refers to the same Product.
_Avoid_: Code, id (the `id` is the surrogate database key, distinct from the SKU).

**Import**:
One execution of ingesting a single CSV file into the catalog. Owns the file reference, the running counters and a terminal outcome. Modeled as `ImportJob`.
_Avoid_: Upload (the upload is only the HTTP transfer of the file), job (ambiguous with the BullMQ job), batch run.

**Row**:
One data line of the CSV, excluding the header. An Import has `totalRows` Rows; each Row becomes either an upserted Product or an Import Error.

**Import Error**:
A single Row rejected for violating a business rule (bad SKU, non-positive price, negative stock, malformed line). It is a DATA outcome recorded against the Import, never a failure of the worker.
_Avoid_: Failure, exception, validation error.

**Data Error**:
An error caused by the contents of a Row. It produces an Import Error, is counted in `failedRows`, and NEVER triggers a retry.
_Avoid_: Validation failure, bad data (too vague).

**Infrastructure Error**:
A transient technical fault (database unreachable, Redis down, timeout). It is NOT recorded per Row; it fails the current Job Attempt and triggers a retry.
_Avoid_: System error, crash.

**Job Attempt**:
One technical execution of an Import by a worker. An Import may accumulate several Attempts across retries; each Attempt records when it ran and why it failed, if it did. Modeled as `JobAttempt`.
_Avoid_: Retry (a retry is the act that creates a new Attempt), run, try.

**Batch**:
A fixed-size group of Rows (default 100) processed and committed together in a single PostgreSQL transaction.
_Avoid_: Chunk, page, lot.

**Checkpoint**:
The persisted marker of how many Batches of an Import are already committed. On a retry the worker resumes after the last Checkpoint so counters are never double-counted.
_Avoid_: Cursor, offset, bookmark.

**Upsert**:
Inserting a Product or updating it in place when its SKU already exists. The reason re-importing the same file is safe and never duplicates Products.
_Avoid_: Insert-or-update, merge.

**Outbox**:
A PostgreSQL table where the API records the intent to enqueue a job inside the same transaction that persists the Import. A relay publishes Outbox entries to the queue, so an Import is never lost when PostgreSQL commits but Redis is unreachable.
_Avoid_: Event log, queue table, buffer.

## Import lifecycle

The status of an Import. `COMPLETED_WITH_ERRORS` is a terminal SUCCESS of the worker with some Rows rejected — it is NOT a technical failure.

**QUEUED**:
Accepted and enqueued, not yet picked up by a worker.

**PROCESSING**:
A worker is actively consuming Batches.

**RETRYING**:
A Job Attempt hit an Infrastructure Error; a new Attempt is scheduled with backoff.

**COMPLETED**:
Terminal. Every Row became a Product; zero Import Errors.

**COMPLETED_WITH_ERRORS**:
Terminal. All Rows processed; at least one Import Error recorded. Valid Rows were still imported.

**FAILED**:
Terminal. All Attempts exhausted on Infrastructure Errors; the Import did not finish.
