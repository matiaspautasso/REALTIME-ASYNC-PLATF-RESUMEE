# REST is the source of truth; WebSocket only notifies

PostgreSQL, read over REST, is the authoritative state of every Import. WebSocket events (`import:progress`, `import:completed`, ...) are notifications that let the UI react without polling; they are never the source of truth.

On connect or reconnect the browser re-fetches the Import over REST (`GET /imports/:id`) to recover the current state, then relies on WebSocket deltas for live updates. A dropped or missed event therefore cannot leave the UI permanently wrong — the next REST read reconciles it.

## Consequences

- Every terminal state transition is persisted BEFORE the corresponding WebSocket event is emitted, so a client re-fetch can never observe a "completed" event without the committed row behind it.
- The frontend treats WebSocket purely as a cache-invalidation / live-delta channel on top of its REST-backed query cache.
