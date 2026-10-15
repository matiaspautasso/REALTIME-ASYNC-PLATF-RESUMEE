# EPIC-08 — Testing

Unit tests ship inside each feature ticket (strict TDD). This epic adds the integration, API and E2E layers that need real infrastructure, and makes the eight mandatory resilience scenarios auditable. See `docs/testing.md`.

---

## TICKET-08.1 — Testcontainers harness

- **Priority**: Obligatory · **Depends on**: 02.3 · **Skill**: `tdd`

A reusable harness that boots real PostgreSQL and Redis in throwaway containers for integration tests.

**Acceptance criteria**

- [ ] A global setup starts containers and runs migrations; teardown disposes them.
- [ ] Integration tests are excluded from `pnpm test:unit`.
- [ ] Works locally and in CI with Docker available.

## TICKET-08.2 — Integration: batch, upsert, checkpoint, outbox

- **Priority**: Obligatory · **Depends on**: 08.1, 04.3, 03.3 · **Skill**: `tdd`

Exercise the worker and repositories against real Postgres/Redis.

**Acceptance criteria**

- [ ] Batch commit persists Products and `ImportError`s atomically.
- [ ] Upsert by SKU updates in place across two imports — mandatory scenario 7.
- [ ] Checkpoint resume skips committed Batches — mandatory scenario 8.
- [ ] Outbox relay publishes once Redis is reachable — mandatory scenario 3.

## TICKET-08.3 — API tests (Supertest)

- **Priority**: Obligatory · **Depends on**: 08.1, 03.2–03.6 · **Skill**: `tdd`

Boot the Nest app and assert the REST contract end to end.

**Acceptance criteria**

- [ ] Create → history → detail → errors → retry covered.
- [ ] Validation failures return the documented `4xx` codes.
- [ ] Responses match `packages/contracts` shapes.

## TICKET-08.4 — Resilience scenario suite

- **Priority**: Obligatory · **Depends on**: 08.2 · **Skill**: `tdd`

One test per mandatory scenario in `docs/testing.md`, each naming its number.

**Acceptance criteria**

- [ ] All eight scenarios have a passing test.
- [ ] Worker-interrupt and retry-after-batch tests assert NO duplicate Products or counters — scenarios 4 and 8.
- [ ] Data-error-no-retry vs infra-error-retry are distinguished — scenario 5.

## TICKET-08.5 — Playwright E2E

- **Priority**: Obligatory · **Depends on**: 06.3, 06.4 · **Skill**: `tdd`
- **RF**: RF-05, RF-06

A browser test uploading a CSV and watching progress reach a terminal state.

**Acceptance criteria**

- [ ] Uploads a sample CSV and asserts progress advances then completes.
- [ ] Runs against the Docker Compose stack in CI.
