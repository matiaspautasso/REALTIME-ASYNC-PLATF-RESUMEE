# EPIC-06 — Frontend

`apps/web` (React + Vite + TypeScript). TanStack Query owns server state over REST; Socket.IO delivers live deltas. REST is the source of truth — the socket invalidates/patches the query cache (ADR-0006).

---

## TICKET-06.1 — App shell, API client and socket client

- **Priority**: Obligatory · **Depends on**: 01.2, 01.3 · **Skill**: `codebase-design`
- **RF**: RF-06

Vite app with a typed REST client (using `packages/contracts` types), a TanStack Query provider, and a Socket.IO client wrapper that subscribes per Import.

**Acceptance criteria**

- [x] REST client and event payloads are typed from `packages/contracts` (no hand-redeclared shapes).
- [x] On socket (re)connect the app re-fetches via REST before applying deltas — mandatory scenario 6.
- [x] `VITE_API_URL` configures the backend origin.

## TICKET-06.2 — Dashboard

- **Priority**: Obligatory · **Depends on**: 06.1, 03.4 · **Skill**: `prototype` then `tdd`
- **RF**: RF-09

The landing dashboard: total imports, in-process count, finished count, and a list of active imports with live progress.

**Acceptance criteria**

- [x] Counters reflect `GET /imports` data.
- [x] Active imports show a live progress bar driven by `import:progress`.

## TICKET-06.3 — New import (upload)

- **Priority**: Obligatory · **Depends on**: 06.1, 03.2 · **Skill**: `tdd`
- **RF**: RF-01

A CSV upload screen that posts to `/imports` and routes to the detail view on `202`.

**Acceptance criteria**

- [x] Client-side guard for type and 5 MB before upload; server remains the authority.
- [x] A `400` from the API surfaces the reason without leaving the screen.

## TICKET-06.4 — Import detail (live)

- **Priority**: Obligatory · **Depends on**: 06.1, 03.4, 05.3 · **Skill**: `tdd`
- **RF**: RF-05, RF-06, RF-08

Detail view: percentage, processed/total, success/failed counts, status, the error list and the attempt history — updating live.

**Acceptance criteria**

- [x] Subscribes to the Import's room and updates progress without a manual refresh.
- [x] Shows the terminal outcome distinctly for `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`.
- [x] Lists `JobAttempt`s with their outcome.

## TICKET-06.5 — History, retry and error download

- **Priority**: Obligatory · **Depends on**: 06.1, 03.4, 03.5, 03.6 · **Skill**: `tdd`
- **RF**: RF-09, RF-10, RF-12

Paginated, filterable history table with a retry action on `FAILED` rows and an errors.csv download.

**Acceptance criteria**

- [x] Table paginates and filters by status.
- [x] Retry is offered ONLY on `FAILED` imports and calls `POST /imports/:id/retry`.
- [x] Error download hits `GET /imports/:id/errors.csv`.
