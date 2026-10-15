# EPIC-01 — Contracts

`packages/contracts` is pure TypeScript with no runtime dependencies: the domain rules, the status state machine, the DTOs and the WebSocket event payloads that every app shares. Keeping this logic here is what makes it unit-testable with no I/O.

---

## TICKET-01.1 — Domain core: status machine, progress, row validation

- **Priority**: Obligatory · **Depends on**: 00.1 · **Skill**: `tdd`
- **RF**: RF-02 (column/rule validation), RF-05 (progress)

The pure heart of the domain, built test-first. Three units:

1. **`ImportStatus`** — the enum plus `isTerminal(status)` and `canTransition(from, to)` encoding the lifecycle in `CONTEXT.md` (`QUEUED → PROCESSING → {COMPLETED | COMPLETED_WITH_ERRORS | FAILED}`, with `PROCESSING ↔ RETRYING`).
2. **`calculateProgress(processedRows, totalRows)`** — integer percent 0–100; `totalRows === 0 ⇒ 100`; never exceeds 100; clamps.
3. **`validateProductRow(raw)`** — applies the business rules and returns a discriminated union: a normalized valid Product, or an `ImportError` carrying `rowNumber` and an `errorCode`.

Business rules (from the spec): required `sku,name,price,stock`; `sku` non-empty; `price > 0`; `stock >= 0` and integer; numeric fields parseable.

**Acceptance criteria**

- [x] Every unit has `*.spec.ts` written BEFORE its implementation (red first).
- [x] `isTerminal` / `canTransition` reject every illegal transition (e.g. `COMPLETED → PROCESSING`).
- [x] `calculateProgress` covered for 0 rows, partial, exactly full, and over-count.
- [x] `validateProductRow` returns a distinct `errorCode` per rule and NEVER throws on bad data (a Data Error is a value, not an exception — see `CONTEXT.md`).
- [x] Package has zero runtime `dependencies`; builds to `dist` with type declarations.

## TICKET-01.2 — DTOs and pagination shapes

- **Priority**: Obligatory · **Depends on**: 01.1 · **Skill**: `domain-modeling`
- **RF**: RF-01, RF-09

Shared request/response types: the `POST /imports` 202 body, the Import detail shape, a generic `Paginated<T>`, and the products/errors list items. These are the REST contract consumed by `apps/web` and asserted by API tests.

**Acceptance criteria**

- [x] Types match the examples in `docs/api.md` exactly (field names and casing).
- [x] `Paginated<T>` carries `items`, `total`, `page`, `pageSize`.
- [x] No framework imports — plain interfaces/types reusable on the client.

## TICKET-01.3 — WebSocket event contract and error codes

- **Priority**: Obligatory · **Depends on**: 01.1 · **Skill**: `domain-modeling`
- **RF**: RF-06, RF-08

The event-name constants (`import:subscribe`, `import:progress`, `import:completed`, `import:failed`, `import:retrying`), their payload types, and the `ImportErrorCode` enum shared by validation (01.1), the worker and the errors.csv export.

**Acceptance criteria**

- [x] One source of truth for event names, imported by both the API gateway and the web client.
- [x] The progress payload matches the example in `docs/api.md`.
- [x] `ImportErrorCode` is the same enum `validateProductRow` returns.
