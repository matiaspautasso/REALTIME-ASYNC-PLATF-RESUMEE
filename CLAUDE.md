# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

JobFlow — distributed, asynchronous CSV product-import platform. Read [`CONTEXT.md`](./CONTEXT.md) for the domain vocabulary and [`docs/architecture.md`](./docs/architecture.md) for the process topology before changing behaviour. Decisions are in [`docs/adr/`](./docs/adr); the backlog is in [`docs/tickets/`](./docs/tickets).

## Working here

- **Use the Matt Pocock skills (`mattpocock-skills:*`) for this repo** — load the matching skill BEFORE acting: `tdd` for any feature or bug fix, `diagnosing-bugs` when something breaks, `domain-modeling` when touching `CONTEXT.md`/ADRs, `code-review` before finishing a ticket, `codebase-design` when shaping a module's interface.
- **Strict TDD.** Write the failing test first (red), make it pass (green), then refactor. Pure domain logic (row rules, progress, the status state machine) lives in `packages/contracts` precisely so it is unit-testable with no I/O.
- Pick work from `docs/tickets/`. Each ticket names its acceptance criteria, the skill to use, and its dependencies. Do them in dependency order.
- Use the canonical terms from `CONTEXT.md` in code, DTOs, events and commits. Business rules belong in `packages/contracts`, not duplicated in the API or worker.

## Commands

Run from the repo root (Turborepo fans out to the right packages):

```bash
pnpm install            # install the whole workspace
pnpm dev                # run api + worker + web in watch mode
pnpm test               # all tests
pnpm test:unit          # unit only (no Docker needed)
pnpm test:integration   # Testcontainers — needs Docker
pnpm lint
pnpm typecheck
pnpm --filter @jobflow/contracts test         # one package
pnpm --filter @jobflow/contracts test -- -t "progress"   # one test by name
pnpm db:migrate         # apply Prisma migrations (needs a running Postgres)
pnpm db:generate        # regenerate the Prisma client
docker compose -f infra/docker-compose.yml up --build   # full stack
```

## Non-obvious constraints

- **CSV bytes never go through Redis** — the API writes the file to the shared volume and enqueues only the path + import id (ADR-0003).
- **Enqueue through the Outbox**, never a bare `queue.add` after commit — the Import row and the enqueue intent must commit in the same transaction (ADR-0004).
- **The worker must be idempotent** — upsert by SKU and resume after the last Checkpoint; a job can run more than once (ADR-0005).
- **Persist terminal state before emitting its WebSocket event** — REST is the source of truth, WebSocket only notifies (ADR-0006).
- **Data Errors vs Infrastructure Errors** — a bad Row is recorded as an `ImportError` and never retried; a transient technical fault fails the Attempt and retries. Keep them distinct in code.
