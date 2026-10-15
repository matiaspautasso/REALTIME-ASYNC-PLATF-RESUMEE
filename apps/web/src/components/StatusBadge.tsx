import type { ImportStatus } from '@jobflow/contracts';
import { statusDisplay } from '../lib/status';

/** Coloured pill showing an Import's status. The three terminal states use
 * distinct tones (success / warning / error) so they never look alike. */
export function StatusBadge({ status }: { status: ImportStatus }) {
  const { label, tone } = statusDisplay(status);
  return (
    <span className={`badge badge--${tone}`} data-testid="status-badge">
      {label}
    </span>
  );
}
