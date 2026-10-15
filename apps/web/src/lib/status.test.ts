import { describe, expect, it } from 'vitest';
import { ImportStatus } from '@jobflow/contracts';
import { statusDisplay } from './status';

describe('statusDisplay', () => {
  it('maps every status to a non-empty label', () => {
    for (const status of Object.values(ImportStatus)) {
      expect(statusDisplay(status).label.length).toBeGreaterThan(0);
    }
  });

  it('gives the three terminal states DISTINCT tones', () => {
    const tones = [
      statusDisplay(ImportStatus.COMPLETED).tone,
      statusDisplay(ImportStatus.COMPLETED_WITH_ERRORS).tone,
      statusDisplay(ImportStatus.FAILED).tone,
    ];
    expect(new Set(tones).size).toBe(3);
  });

  it('labels COMPLETED_WITH_ERRORS distinctly from COMPLETED', () => {
    expect(statusDisplay(ImportStatus.COMPLETED_WITH_ERRORS).label).not.toBe(
      statusDisplay(ImportStatus.COMPLETED).label,
    );
  });
});
