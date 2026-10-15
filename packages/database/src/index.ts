import { PrismaClient, Prisma } from '@prisma/client';

// Re-export the generated client types and enums so consumers depend only on
// @jobflow/database, never on @prisma/client directly.
export * from '@prisma/client';

/**
 * Shared PrismaClient singleton. The API and the worker import this instead of
 * constructing their own, so connection handling stays in one place.
 */
export const prisma = new PrismaClient();

/** The transaction-scoped client Prisma passes to an interactive transaction. */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Run `fn` inside a single interactive transaction. The worker uses this to
 * commit a whole Batch atomically — upserts, error rows, counters and the
 * checkpoint together (ADR-0005).
 */
export function runInTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
