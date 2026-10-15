# API and worker run as separate processes

The API (`apps/api`) and the worker (`apps/worker`) are independent NestJS applications with their own Docker images and lifecycles. The API accepts requests and enqueues jobs; the worker consumes the queue and does the heavy CSV processing.

They are separated — rather than running the worker inside the API via an in-process BullMQ consumer — so that slow imports never block HTTP throughput, and so the worker can be scaled or restarted independently. This separation is what makes the resilience requirements (crash recovery, concurrency limits, independent retries) meaningful instead of theoretical.

## Consequences

- Both processes share `packages/database` (Prisma) and `packages/contracts`; neither imports the other's application code.
- Realtime events flow worker → Redis (BullMQ `QueueEvents`) → API WebSocket gateway → browser; the worker never holds WebSocket connections.
