import { ImportStatus } from '@jobflow/contracts';

/**
 * Presentation metadata for each ImportStatus (06.4 / 06.5).
 *
 * `tone` groups statuses into the visual families the UI colours by. The three
 * terminal states map to DISTINCT tones so COMPLETED, COMPLETED_WITH_ERRORS and
 * FAILED never look alike — the acceptance criterion for the detail badge.
 */
export type StatusTone = 'queued' | 'active' | 'success' | 'warning' | 'error';

export interface StatusDisplay {
  label: string;
  tone: StatusTone;
}

const DISPLAY: Record<ImportStatus, StatusDisplay> = {
  [ImportStatus.QUEUED]: { label: 'Queued', tone: 'queued' },
  [ImportStatus.PROCESSING]: { label: 'Processing', tone: 'active' },
  [ImportStatus.RETRYING]: { label: 'Retrying', tone: 'active' },
  [ImportStatus.COMPLETED]: { label: 'Completed', tone: 'success' },
  [ImportStatus.COMPLETED_WITH_ERRORS]: {
    label: 'Completed with errors',
    tone: 'warning',
  },
  [ImportStatus.FAILED]: { label: 'Failed', tone: 'error' },
};

/** The label + tone used to render a status badge. */
export function statusDisplay(status: ImportStatus): StatusDisplay {
  return DISPLAY[status];
}
