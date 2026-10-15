# Transactional outbox for reliable job publishing

Creating an Import writes a row to PostgreSQL AND enqueues a BullMQ job. These are two systems: if PostgreSQL commits and the Redis enqueue then fails, the Import would be stuck in `QUEUED` forever with no worker ever picking it up.

We write the enqueue intent to an `Outbox` table inside the same transaction that persists the Import. A relay (a lightweight poller on the API side) reads unpublished Outbox rows and enqueues them to BullMQ, marking each published on success. The database commit is the single atomic point; publishing becomes retryable and at-least-once.

## Considered Options

- **Enqueue directly after commit, no outbox**: simplest, but loses jobs on the commit-succeeds / enqueue-fails window — exactly the resilience scenario the spec calls out.
- **Two-phase commit across Postgres and Redis**: not supported by these systems and far too heavy for an MVP.

The outbox is the standard, well-understood answer to dual-write consistency and is the project's headline resilience pattern.

## Consequences

- Publishing is at-least-once, so the worker must be idempotent per Import. See ADR-0005.
