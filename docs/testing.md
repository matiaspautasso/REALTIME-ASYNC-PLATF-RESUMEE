# Testing strategy

The point of this project is resilience, so the test suite's job is to prove the hard guarantees — idempotency, recovery, retries, reconnect — not just the happy path. Tests are written test-first (red → green → refactor); see the `tdd` skill.

## Levels

| Level | Tool | Scope |
| --- | --- | --- |
| Unit | Jest | Pure domain logic in `packages/contracts`: row validation, business rules, progress, status state machine. No I/O. |
| Integration | Jest + Testcontainers | Worker and repositories against REAL PostgreSQL and Redis in throwaway containers. Batch commits, upserts, checkpoints, outbox relay. |
| API | Jest + Supertest | Endpoints end to end against a booted Nest app: create, history, detail, errors, retry. |
| E2E | Playwright | Browser uploads a CSV and watches progress reach a terminal state. |

Unit tests gate every change and run with no containers; integration and E2E need Docker.

## Mandatory scenarios

These map directly to the resilience requirements and must each have a test:

1. **Valid CSV** — every Row becomes a Product; status `COMPLETED`.
2. **Partially invalid CSV** — valid Rows import, invalid Rows become `ImportError`; status `COMPLETED_WITH_ERRORS`; no valid Row blocked by an invalid one.
3. **Redis temporarily down** — the request is not permanently lost; the Outbox relay publishes once Redis recovers.
4. **Worker interrupted mid-import** — on resume, no Products and no counters are duplicated (checkpoint + upsert).
5. **Transient infrastructure failure** — the Attempt retries with backoff and eventually succeeds; Data Errors do NOT trigger retries.
6. **WebSocket disconnect** — on reconnect the UI shows correct progress via REST re-fetch.
7. **Two imports with overlapping SKUs** — deterministic, integrity preserved.
8. **Retry after a committed Batch** — counters are not double-counted.

## Conventions

- Unit test files sit beside the code: `*.spec.ts` under `src/` (Jest), `*.test.ts(x)` for the web (Vitest).
- Integration tests live under `apps/<app>/test/` (`*.int-spec.ts` / `*.e2e-spec.ts`), boot real PostgreSQL + Redis with Testcontainers in a Jest global setup, run serially, and are excluded from the default unit run.
- Each mandatory scenario names the number above in its `describe` so coverage is auditable (see `apps/worker/test/resilience-scenarios.int-spec.ts` and the outbox recovery test for scenario 3).
- Coverage is reported per package and aggregated in CI (see [adr/](./adr) and the CI workflow).
