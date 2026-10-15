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

/** An ImportJob snapshot as both the worker and the API read it (id, counters,
 * status) — the input the wire payload is built from. */
export interface ImportJobSnapshot {
  id: string;
  status: ImportStatus;
  progress: number;
  processedRows: number;
  totalRows: number;
  successRows: number;
  failedRows: number;
}

/** Build the wire payload from an ImportJob snapshot, renaming `id` to the
 * `importId` the client keys on. The single place this mapping lives. */
export function toImportEventPayload(job: ImportJobSnapshot): ImportEventPayload {
  return {
    importId: job.id,
    status: job.status,
    progress: job.progress,
    processedRows: job.processedRows,
    totalRows: job.totalRows,
    successRows: job.successRows,
    failedRows: job.failedRows,
  };
}

/** The lifecycle event name a status maps to: terminal success → Completed,
 * FAILED → Failed, RETRYING → Retrying, anything else → Progress. */
export function lifecycleEventFor(status: ImportStatus): ImportEventName {
  switch (status) {
    case ImportStatus.COMPLETED:
    case ImportStatus.COMPLETED_WITH_ERRORS:
      return ImportEvents.Completed;
    case ImportStatus.FAILED:
      return ImportEvents.Failed;
    case ImportStatus.RETRYING:
      return ImportEvents.Retrying;
    default:
      return ImportEvents.Progress;
  }
}
