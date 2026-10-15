import { ImportStatus } from '@jobflow/contracts';
import { resolveTerminalStatus } from './terminal-status';

describe('resolveTerminalStatus', () => {
  it('is COMPLETED when no row failed', () => {
    expect(resolveTerminalStatus(0)).toBe(ImportStatus.COMPLETED);
  });

  it('is COMPLETED_WITH_ERRORS when at least one row failed', () => {
    expect(resolveTerminalStatus(1)).toBe(ImportStatus.COMPLETED_WITH_ERRORS);
    expect(resolveTerminalStatus(42)).toBe(ImportStatus.COMPLETED_WITH_ERRORS);
  });
});
