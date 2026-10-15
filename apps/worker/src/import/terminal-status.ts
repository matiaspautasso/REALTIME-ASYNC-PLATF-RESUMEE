import { ImportStatus } from '@jobflow/contracts';

/**
 * The terminal status of a finished Import. A run that rejected at least one
 * Row ends COMPLETED_WITH_ERRORS — a success with Data Errors, not a technical
 * failure; a clean run ends COMPLETED (TICKET-04.5).
 */
export function resolveTerminalStatus(failedRows: number): ImportStatus {
  return failedRows === 0 ? ImportStatus.COMPLETED : ImportStatus.COMPLETED_WITH_ERRORS;
}
