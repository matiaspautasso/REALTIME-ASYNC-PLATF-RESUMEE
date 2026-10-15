# EPIC-05 — Realtime

Progress flows worker → Redis (BullMQ `QueueEvents`) → API WebSocket gateway → browser. The worker never holds a socket (ADR-0002); REST stays the source of truth (ADR-0006).

---

## TICKET-05.1 — QueueEvents bridge

- **Priority**: Obligatory · **Depends on**: 04.5 · **Skill**: `tdd`
- **RF**: RF-06

On the API side, subscribe to BullMQ `QueueEvents` (and worker-emitted progress) and translate them into domain events keyed by `importId`.

**Acceptance criteria**

- [ ] Progress, completion, failure and retry signals from the queue are received on the API side.
- [ ] Each is mapped to the `packages/contracts` event payload with the current `importId`.

## TICKET-05.2 — WebSocket gateway and subscriptions

- **Priority**: Obligatory · **Depends on**: 05.1 · **Skill**: `tdd`
- **RF**: RF-06

A Socket.IO gateway on namespace `/imports`. Clients send `import:subscribe { importId }` to join that Import's room.

**Acceptance criteria**

- [ ] A client that subscribes to `imp_A` receives only `imp_A` events, not `imp_B`'s.
- [ ] Event names come from the single source of truth in `packages/contracts` (01.3).
- [ ] Subscribing does not itself mutate state; it only joins a room.

## TICKET-05.3 — Emit lifecycle events

- **Priority**: Obligatory · **Depends on**: 05.2 · **Skill**: `tdd`
- **RF**: RF-05, RF-06, RF-07

Emit `import:progress`, `import:completed`, `import:failed` and `import:retrying` to the room as the Import advances.

**Acceptance criteria**

- [ ] `import:progress` carries the full payload from `docs/api.md`.
- [ ] `import:completed`/`import:failed` fire only after the terminal state is persisted (ADR-0006).
- [ ] `import:retrying` fires when a new Attempt is scheduled.
