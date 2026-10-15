/**
 * The lifecycle status of an Import. See CONTEXT.md for the domain meaning of
 * each state. COMPLETED_WITH_ERRORS is a terminal SUCCESS with some rejected
 * rows, not a technical failure.
 */
export enum ImportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  RETRYING = 'RETRYING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS',
  FAILED = 'FAILED',
}

const TERMINAL: ReadonlySet<ImportStatus> = new Set([
  ImportStatus.COMPLETED,
  ImportStatus.COMPLETED_WITH_ERRORS,
  ImportStatus.FAILED,
]);

/** A terminal status means the run has ended (it may still be manually retried). */
export function isTerminal(status: ImportStatus): boolean {
  return TERMINAL.has(status);
}

const TRANSITIONS: Readonly<Record<ImportStatus, readonly ImportStatus[]>> = {
  [ImportStatus.QUEUED]: [ImportStatus.PROCESSING],
  [ImportStatus.PROCESSING]: [
    ImportStatus.RETRYING,
    ImportStatus.COMPLETED,
    ImportStatus.COMPLETED_WITH_ERRORS,
    ImportStatus.FAILED,
  ],
  [ImportStatus.RETRYING]: [ImportStatus.PROCESSING, ImportStatus.FAILED],
  [ImportStatus.COMPLETED]: [],
  [ImportStatus.COMPLETED_WITH_ERRORS]: [],
  // A FAILED import is terminal, but RF-10 allows a manual retry that re-queues it.
  [ImportStatus.FAILED]: [ImportStatus.QUEUED],
};

/** Whether moving an Import from `from` to `to` is a legal lifecycle transition. */
export function canTransition(from: ImportStatus, to: ImportStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
