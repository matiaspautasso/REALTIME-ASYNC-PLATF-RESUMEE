# API contracts

REST is the source of truth; WebSocket carries live deltas (ADR-0006). The authoritative, always-current contract is the Swagger UI the API serves at `/docs`; this file is the human-readable overview. Shared request/response shapes live in `packages/contracts`.

## REST

| Method | Endpoint | Purpose | Success |
| --- | --- | --- | --- |
| `POST` | `/imports` | Upload a CSV and create an Import | `202 Accepted` |
| `GET` | `/imports` | Paginated history | `200` |
| `GET` | `/imports/:id` | Status and metrics of one Import | `200` |
| `GET` | `/imports/:id/errors` | Row-level Import Errors (paginated) | `200` |
| `GET` | `/imports/:id/errors.csv` | Import Errors as a CSV download | `200` |
| `POST` | `/imports/:id/retry` | Retry an Import in a terminal `FAILED` state | `202 Accepted` |
| `GET` | `/products` | Imported Products (paginated, filterable by SKU) | `200` |
| `GET` | `/health` | Liveness of API, PostgreSQL and Redis | `200` |

### `POST /imports`

`multipart/form-data` with a single `file` field. Validated synchronously: content type CSV, size ≤ 5 MB, header contains `sku,name,price,stock`. Rejected files return `400` and create no Import. On success the server returns before processing has started:

```json
{
  "id": "imp_123",
  "status": "QUEUED",
  "progress": 0,
  "totalRows": 10000
}
```

`202 Accepted` means the work is accepted but not finished — poll `GET /imports/:id` or subscribe over WebSocket for progress.

### `GET /imports/:id`

```json
{
  "id": "imp_123",
  "fileName": "products_october.csv",
  "status": "PROCESSING",
  "progress": 65,
  "totalRows": 10000,
  "processedRows": 6500,
  "successRows": 6480,
  "failedRows": 20,
  "createdAt": "2026-10-15T10:00:00.000Z",
  "updatedAt": "2026-10-15T10:01:12.000Z"
}
```

## WebSocket

Socket.IO namespace `/imports`.

**Client → server**

- `import:subscribe` `{ importId }` — join the room for one Import and start receiving its events.

**Server → client** (payload shape shared via `packages/contracts`)

| Event | When |
| --- | --- |
| `import:progress` | After each committed Batch |
| `import:completed` | Terminal `COMPLETED` or `COMPLETED_WITH_ERRORS`, persisted first |
| `import:failed` | Terminal `FAILED` after all Attempts exhausted |
| `import:retrying` | A new Attempt scheduled after an Infrastructure Error |

```json
{
  "importId": "imp_123",
  "status": "PROCESSING",
  "progress": 65,
  "processedRows": 6500,
  "totalRows": 10000,
  "successRows": 6480,
  "failedRows": 20
}
```

On (re)connect the client re-fetches `GET /imports/:id` to recover authoritative state, then applies events as deltas. A missed event is corrected by the next REST read.
