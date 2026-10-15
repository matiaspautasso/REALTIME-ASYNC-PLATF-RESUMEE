import { ImportStatus } from './import-status';

/** Socket.IO namespace that carries all Import lifecycle events. */
export const IMPORTS_NAMESPACE = '/imports';

/**
 * Socket.IO event names for the Imports namespace. The single source of truth
 * imported by BOTH the API gateway and the web client, so neither side retypes
 * the string literals.
 */
export const ImportEvents = {
  /** client → server: join one Import's room and start receiving its events. */
  Subscribe: 'import:subscribe',
  /** server → client: progress after each committed Batch. */
  Progress: 'import:progress',
  /** server → client: terminal COMPLETED or COMPLETED_WITH_ERRORS (persisted first). */
  Completed: 'import:completed',
  /** server → client: terminal FAILED after all Attempts are exhausted. */
  Failed: 'import:failed',
  /** server → client: a new Attempt scheduled after an Infrastructure Error. */
  Retrying: 'import:retrying',
} as const;

export type ImportEventName = (typeof ImportEvents)[keyof typeof ImportEvents];

/** Payload the client sends to subscribe to one Import. */
export interface ImportSubscribePayload {
  importId: string;
}

/**
 * Payload for every server → client lifecycle event: a live snapshot of the
 * Import. The browser reconciles against REST, which stays the source of truth
 * (ADR-0006), so this is a notification, not authoritative state.
 */
export interface ImportEventPayload {
  importId: string;
  status: ImportStatus;
  progress: number;
  processedRows: number;
  totalRows: number;
  successRows: number;
  failedRows: number;
}
